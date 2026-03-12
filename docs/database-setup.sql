-- ================================================================
-- simp3 Database Setup Script
-- Paste into the Supabase SQL editor of your NEW project and run.
-- ================================================================


-- ========================
-- 1. EXTENSIONS
-- ========================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ========================
-- 2. ENUMS
-- ========================
DO $$ BEGIN
  CREATE TYPE user_type AS ENUM ('CREATOR', 'FAN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE processor AS ENUM ('CCBILL', 'SEGPAY', 'EPOCH');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE media_type AS ENUM ('IMAGE', 'VIDEO');
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ========================
-- 3. TABLES
-- ========================

CREATE TABLE IF NOT EXISTS profiles (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id         uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email                text        NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  user_type            user_type   NOT NULL,
  onboarding_completed boolean     NOT NULL DEFAULT false,
  display_name         text,
  profile_picture_url  text,
  banner_image_url     text,
  ccbill_merchant_id   text,
  monetization_enabled boolean     DEFAULT false,
  about_text           text
);

-- media_assets (needed by tasks)
CREATE TABLE IF NOT EXISTS media_assets (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type          media_type  NOT NULL DEFAULT 'IMAGE',
  title         text,
  playback_ref  text,
  thumbnail_url text,
  file_size     integer,
  mime_type     text,
  created_at    timestamptz NOT NULL DEFAULT NOW()
);

-- tasks: creator-defined monetization items (e.g. "tip me $10", "Chat Access").
-- Fans purchase tasks and earn points in return.
CREATE TABLE IF NOT EXISTS tasks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slug         text        NOT NULL,
  title        text        NOT NULL,
  description  text,
  price_cents  integer     NOT NULL DEFAULT 0,
  points       integer     NOT NULL DEFAULT 0,
  media_id     uuid        REFERENCES media_assets(id) ON DELETE SET NULL,
  active       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (creator_id, slug)
);

-- purchases must exist before chat_access references it
CREATE TABLE IF NOT EXISTS purchases (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id         text        NOT NULL,
  amount_cents    integer     NOT NULL CHECK (amount_cents > 0),
  processor       processor   NOT NULL,
  processor_tx_id text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_access (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id                  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fan_id                      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  state                       text        NOT NULL CHECK (state IN ('granted', 'expired')),
  access_until                timestamptz NOT NULL,
  last_qualifying_purchase_id uuid        REFERENCES purchases(id) ON DELETE SET NULL,
  status                      text,
  created_at                  timestamptz NOT NULL DEFAULT NOW(),
  updated_at                  timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (creator_id, fan_id)
);

CREATE TABLE IF NOT EXISTS chat_rules (
  creator_id        uuid        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  min_spend_cents   integer     NOT NULL DEFAULT 10000,
  access_window_days integer    NOT NULL DEFAULT 30,
  access_days       integer     DEFAULT 30,
  time_unit         text        NOT NULL DEFAULT 'days' CHECK (time_unit IN ('minutes', 'hours', 'days')),
  created_at        timestamptz NOT NULL DEFAULT NOW(),
  updated_at        timestamptz NOT NULL DEFAULT NOW()
);
COMMENT ON COLUMN chat_rules.access_days IS 'Duration value in the unit specified by time_unit (despite the _days suffix)';
COMMENT ON COLUMN chat_rules.time_unit IS 'Unit for access_days: minutes, hours, or days';

-- conversations table (last_message_id FK added after chat_messages)
CREATE TABLE IF NOT EXISTS conversations (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id           uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fan_id               uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_id      uuid,
  last_message_at      timestamptz NOT NULL DEFAULT NOW(),
  last_message_preview text,
  message_count        integer     NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  updated_at           timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (creator_id, fan_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fan_id           uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id        uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content          text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT NOW(),
  is_locked        boolean     NOT NULL DEFAULT false,
  ppv_price_cents  integer,
  media_id         text,
  comped_by_creator boolean    DEFAULT false
);

-- Add FK from conversations → chat_messages now that both tables exist
ALTER TABLE conversations
  ADD CONSTRAINT fk_last_message
  FOREIGN KEY (last_message_id)
  REFERENCES chat_messages(id) ON DELETE SET NULL
  NOT VALID;


-- ========================
-- 4. FUNCTIONS
-- ========================

-- Returns the profile ID for the currently authenticated user.
-- SECURITY DEFINER so RLS policies can call it safely.
CREATE OR REPLACE FUNCTION current_profile_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;


-- Upserts a chat_access record after a qualifying purchase.
-- Stacks on top of any existing unexpired access.
CREATE OR REPLACE FUNCTION update_chat_access(
  p_creator    uuid,
  p_fan        uuid,
  p_purchase_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_access_days    integer;
  v_time_unit      text;
  v_interval       interval;
  v_existing_until timestamptz;
  v_access_until   timestamptz;
BEGIN
  -- Load creator's chat rules; fall back to 30-day default
  SELECT
    COALESCE(access_days, access_window_days, 30),
    COALESCE(time_unit, 'days')
  INTO v_access_days, v_time_unit
  FROM chat_rules
  WHERE creator_id = p_creator;

  IF NOT FOUND THEN
    v_access_days := 30;
    v_time_unit   := 'days';
  END IF;

  -- Build the interval
  CASE v_time_unit
    WHEN 'minutes' THEN v_interval := (v_access_days || ' minutes')::interval;
    WHEN 'hours'   THEN v_interval := (v_access_days || ' hours')::interval;
    ELSE                v_interval := (v_access_days || ' days')::interval;
  END CASE;

  -- If fan already has active access, stack on top of it
  SELECT access_until INTO v_existing_until
  FROM chat_access
  WHERE creator_id = p_creator AND fan_id = p_fan;

  IF v_existing_until IS NOT NULL AND v_existing_until > NOW() THEN
    v_access_until := v_existing_until + v_interval;
  ELSE
    v_access_until := NOW() + v_interval;
  END IF;

  INSERT INTO chat_access (
    creator_id, fan_id, state, access_until,
    last_qualifying_purchase_id, updated_at
  )
  VALUES (
    p_creator, p_fan, 'granted', v_access_until,
    p_purchase_id, NOW()
  )
  ON CONFLICT (creator_id, fan_id) DO UPDATE SET
    state                       = 'granted',
    access_until                = EXCLUDED.access_until,
    last_qualifying_purchase_id = EXCLUDED.last_qualifying_purchase_id,
    updated_at                  = NOW();
END;
$$;


-- Keeps the conversations table in sync whenever a message is inserted.
CREATE OR REPLACE FUNCTION sync_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO conversations (
    creator_id, fan_id,
    last_message_id, last_message_at, last_message_preview,
    message_count
  )
  VALUES (
    NEW.creator_id, NEW.fan_id,
    NEW.id, NEW.created_at, LEFT(NEW.content, 100),
    1
  )
  ON CONFLICT (creator_id, fan_id) DO UPDATE SET
    last_message_id      = NEW.id,
    last_message_at      = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    message_count        = conversations.message_count + 1,
    updated_at           = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_conversation ON chat_messages;
CREATE TRIGGER trg_sync_conversation
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION sync_conversation_on_message();


-- ========================
-- 5. VIEWS
-- ========================

DROP VIEW IF EXISTS conversations_with_last_message;

CREATE VIEW conversations_with_last_message AS
SELECT
  c.id,
  c.creator_id,
  c.fan_id,
  c.created_at,
  c.updated_at,
  creator.id                  AS creator_id_join,
  creator.email               AS creator_email,
  creator.display_name        AS creator_display_name,
  creator.user_type           AS creator_user_type,
  creator.profile_picture_url AS creator_ppu,
  fan.id                      AS fan_id_join,
  fan.email                   AS fan_email,
  fan.display_name            AS fan_display_name,
  fan.user_type               AS fan_user_type,
  fan.profile_picture_url     AS fan_ppu,
  lm.id                       AS last_message_id,
  lm.sender_id                AS last_message_sender_id,
  lm.content                  AS last_message_content,
  lm.created_at               AS last_message_created_at,
  COALESCE(lm.created_at, c.created_at) AS last_message_at,
  ca.id                       AS access_id,
  ca.access_until,
  ca.created_at               AS access_created_at
FROM conversations c
JOIN profiles creator ON creator.id = c.creator_id
JOIN profiles fan     ON fan.id     = c.fan_id
LEFT JOIN LATERAL (
  SELECT * FROM chat_messages m
  WHERE m.creator_id = c.creator_id AND m.fan_id = c.fan_id
  ORDER BY m.created_at DESC
  LIMIT 1
) lm ON true
LEFT JOIN LATERAL (
  SELECT * FROM chat_access a
  WHERE a.creator_id = c.creator_id AND a.fan_id = c.fan_id
  ORDER BY a.access_until DESC NULLS LAST
  LIMIT 1
) ca ON true;

GRANT SELECT ON conversations_with_last_message TO authenticated;


-- ========================
-- 6. ROW LEVEL SECURITY
-- ========================

ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_access    ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases      ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks          ENABLE ROW LEVEL SECURITY;

-- ---------- profiles ----------
-- Public read (creator profile pages work when logged out)
CREATE POLICY "profiles_select_public" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid());

-- ---------- chat_messages ----------
-- Only the creator and fan in the conversation can read messages
CREATE POLICY "messages_select_participants" ON chat_messages
  FOR SELECT TO authenticated
  USING (
    creator_id = current_profile_id()
    OR fan_id  = current_profile_id()
  );

-- Creator can always send; fan must have active chat access
CREATE POLICY "messages_insert_with_access" ON chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = current_profile_id()
    AND (
      creator_id = current_profile_id()
      OR (
        fan_id = current_profile_id()
        AND EXISTS (
          SELECT 1 FROM chat_access ca
          WHERE ca.creator_id   = chat_messages.creator_id
            AND ca.fan_id       = chat_messages.fan_id
            AND ca.state        = 'granted'
            AND ca.access_until > NOW()
        )
      )
    )
  );

-- ---------- chat_access ----------
-- Participants can read; all writes go through update_chat_access() (SECURITY DEFINER)
CREATE POLICY "chat_access_select_participants" ON chat_access
  FOR SELECT TO authenticated
  USING (
    creator_id = current_profile_id()
    OR fan_id  = current_profile_id()
  );

-- ---------- chat_rules ----------
-- All authenticated users can read (needed for creator profiles / payment page)
CREATE POLICY "chat_rules_select_all" ON chat_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "chat_rules_insert_own" ON chat_rules
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = current_profile_id());

CREATE POLICY "chat_rules_update_own" ON chat_rules
  FOR UPDATE TO authenticated
  USING (creator_id = current_profile_id());

-- ---------- conversations ----------
CREATE POLICY "conversations_select_participants" ON conversations
  FOR SELECT TO authenticated
  USING (
    creator_id = current_profile_id()
    OR fan_id  = current_profile_id()
  );

-- Conversations are created automatically by the trigger; direct insert
-- is allowed so the app can initialise a thread before the first message.
CREATE POLICY "conversations_insert_participants" ON conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = current_profile_id()
    OR fan_id  = current_profile_id()
  );

CREATE POLICY "conversations_update_participants" ON conversations
  FOR UPDATE TO authenticated
  USING (
    creator_id = current_profile_id()
    OR fan_id  = current_profile_id()
  );

-- ---------- purchases ----------
-- Buyers can read their own purchase history;
-- Creators can read purchases against their tasks (for dashboard stats);
-- INSERT is done by the payment API via the service role (bypasses RLS).
CREATE POLICY "purchases_select_own" ON purchases
  FOR SELECT TO authenticated
  USING (profile_id = current_profile_id());

CREATE POLICY "purchases_select_creator" ON purchases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id::text = purchases.task_id
        AND t.creator_id = current_profile_id()
    )
  );

-- ---------- media_assets ----------
CREATE POLICY "media_assets_select_all" ON media_assets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "media_assets_insert_own" ON media_assets
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = current_profile_id());

-- ---------- tasks ----------
-- All authenticated users can read tasks (fans browse creator tasks)
CREATE POLICY "tasks_select_all" ON tasks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "tasks_insert_own" ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = current_profile_id());

CREATE POLICY "tasks_update_own" ON tasks
  FOR UPDATE TO authenticated
  USING (creator_id = current_profile_id());


-- ========================
-- 7. PERFORMANCE INDEXES
-- ========================

-- profiles
CREATE INDEX IF NOT EXISTS profiles_auth_user_id_idx
  ON profiles(auth_user_id);

-- chat_messages
CREATE INDEX IF NOT EXISTS chat_messages_c_f_created_at_idx
  ON chat_messages(creator_id, fan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_sender_idx
  ON chat_messages(sender_id);

-- chat_access
CREATE INDEX IF NOT EXISTS chat_access_creator_fan_idx
  ON chat_access(creator_id, fan_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS chat_access_creator_updated_idx
  ON chat_access(creator_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS chat_access_fan_updated_idx
  ON chat_access(fan_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS chat_access_c_f_until_idx
  ON chat_access(creator_id, fan_id, access_until DESC);
CREATE INDEX IF NOT EXISTS chat_access_active_until_idx
  ON chat_access(access_until DESC) WHERE access_until IS NOT NULL;

-- conversations
CREATE INDEX IF NOT EXISTS conversations_creator_last_idx
  ON conversations(creator_id, created_at DESC, id);
CREATE INDEX IF NOT EXISTS conversations_fan_last_idx
  ON conversations(fan_id, created_at DESC, id);

-- purchases
CREATE INDEX IF NOT EXISTS purchases_profile_id_idx
  ON purchases(profile_id);

-- chat_rules
CREATE INDEX IF NOT EXISTS chat_rules_time_unit_idx
  ON chat_rules(time_unit);


-- ========================
-- 8. VIEWS (continued)
-- ========================

-- conversations_inbox: used by ChatInbox + chat page SSR.
-- Extends conversations with pre-computed chat access fields so the
-- inbox can be loaded in a single query.
DROP VIEW IF EXISTS conversations_inbox;

CREATE VIEW conversations_inbox AS
SELECT
  c.id,
  c.creator_id,
  c.fan_id,
  c.last_message_id,
  c.last_message_at,
  c.last_message_preview,
  c.message_count,
  c.created_at,
  c.updated_at,
  CASE
    WHEN ca.state = 'granted' AND ca.access_until > NOW() THEN true
    ELSE false
  END AS has_access,
  COALESCE(
    GREATEST(EXTRACT(EPOCH FROM (ca.access_until - NOW()))::bigint, 0),
    0
  ) AS seconds_remaining,
  ca.access_until
FROM conversations c
LEFT JOIN LATERAL (
  SELECT state, access_until
  FROM chat_access a
  WHERE a.creator_id = c.creator_id AND a.fan_id = c.fan_id
  ORDER BY a.access_until DESC NULLS LAST
  LIMIT 1
) ca ON true;

GRANT SELECT ON conversations_inbox TO authenticated;


-- ========================
-- 9. REALTIME
-- ========================
-- Enable Postgres Changes realtime on the tables that clients subscribe to.
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_access;


-- ========================
-- 9. ANALYZE
-- ========================
ANALYZE profiles;
ANALYZE chat_messages;
ANALYZE chat_access;
ANALYZE chat_rules;
ANALYZE conversations;
ANALYZE purchases;
