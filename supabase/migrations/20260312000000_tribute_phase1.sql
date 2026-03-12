-- ================================================================
-- Tribute Phase 1 — Full Schema Migration
-- Run against the live Supabase project after the pending_schema_changes migration.
-- Safe to run multiple times (IF NOT EXISTS / DO $$ guards throughout).
-- ================================================================


-- ========================
-- 1. ALTER profiles
-- (banner_image_url, about_text already exist — skip)
-- ========================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS handle           TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS wallet_address   TEXT,
  ADD COLUMN IF NOT EXISTS age_verified     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS age_verified_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tribute_alias    TEXT,
  ADD COLUMN IF NOT EXISTS vip_cta_text     TEXT,
  ADD COLUMN IF NOT EXISTS tagline          TEXT,
  ADD COLUMN IF NOT EXISTS kyc_status       TEXT DEFAULT 'PENDING';


-- ========================
-- 2. DROP chat_rules
-- ========================
DROP TABLE IF EXISTS chat_rules CASCADE;


-- ========================
-- 3. CREATE new enums
-- (media_type, user_type already exist — skip)
-- ========================
DO $$ BEGIN
  CREATE TYPE task_type AS ENUM ('REPETITION', 'SUBMISSION', 'EVIDENCE', 'CONTENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE completion_status AS ENUM ('ACCEPTED', 'SUBMITTED', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE vip_tier_type AS ENUM ('GROUP', 'PRIVATE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE threshold_type AS ENUM ('TOP_PERCENT', 'TOP_N');
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ========================
-- 4. ALTER media_assets
-- ========================
ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS bunny_url         TEXT,
  ADD COLUMN IF NOT EXISTS bunny_preview_url TEXT,
  ADD COLUMN IF NOT EXISTS price_usdc        NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS is_on_wall        BOOLEAN DEFAULT false;


-- ========================
-- 5. ALTER tasks
-- ========================
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS task_type            task_type,
  ADD COLUMN IF NOT EXISTS status               task_status DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS price_usdc           NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS instructions         TEXT,
  ADD COLUMN IF NOT EXISTS repetition_phrase    TEXT,
  ADD COLUMN IF NOT EXISTS required_repetitions INTEGER;


-- ========================
-- 6. Migrate tasks active → status
-- ========================
UPDATE tasks SET status = 'PUBLISHED' WHERE active = true  AND status IS NULL;
UPDATE tasks SET status = 'ARCHIVED'  WHERE active = false AND status IS NULL;
-- Fill in remaining nulls (shouldn't happen but be safe)
UPDATE tasks SET status = 'DRAFT' WHERE status IS NULL;


-- ========================
-- 7. CREATE task_completions
-- ========================
CREATE TABLE IF NOT EXISTS task_completions (
  id                UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id           UUID             NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  fan_id            UUID             NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status            completion_status NOT NULL DEFAULT 'ACCEPTED',
  payment_tx_hash   TEXT,
  amount_usdc       NUMERIC(18,6),
  tribute_message   TEXT             NOT NULL,
  submission_text   TEXT,
  evidence_url      TEXT,
  repetition_count  INTEGER,
  dom_feedback      TEXT,
  accepted_at       TIMESTAMPTZ      DEFAULT now(),
  submitted_at      TIMESTAMPTZ,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ      DEFAULT now()
);

ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

-- Fan can read own completions
DO $$ BEGIN
  CREATE POLICY "task_completions_select_own_fan" ON task_completions
    FOR SELECT TO authenticated
    USING (fan_id = current_profile_id());
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Creator (dom) can read completions on their tasks
DO $$ BEGIN
  CREATE POLICY "task_completions_select_own_dom" ON task_completions
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.id = task_completions.task_id
          AND t.creator_id = current_profile_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Fan can insert (when accepting a task)
DO $$ BEGIN
  CREATE POLICY "task_completions_insert_fan" ON task_completions
    FOR INSERT TO authenticated
    WITH CHECK (fan_id = current_profile_id());
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Dom can update (approve/reject)
DO $$ BEGIN
  CREATE POLICY "task_completions_update_dom" ON task_completions
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.id = task_completions.task_id
          AND t.creator_id = current_profile_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Fan can update own (to submit evidence/text)
DO $$ BEGIN
  CREATE POLICY "task_completions_update_fan" ON task_completions
    FOR UPDATE TO authenticated
    USING (fan_id = current_profile_id());
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ========================
-- 8. CREATE content_unlocks
-- ========================
CREATE TABLE IF NOT EXISTS content_unlocks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id           UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_id         UUID        NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  payment_tx_hash  TEXT,
  amount_usdc      NUMERIC(18,6),
  unlocked_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(fan_id, media_id)
);

ALTER TABLE content_unlocks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "content_unlocks_select_fan" ON content_unlocks
    FOR SELECT TO authenticated
    USING (fan_id = current_profile_id());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "content_unlocks_select_dom" ON content_unlocks
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM media_assets ma
        WHERE ma.id = content_unlocks.media_id
          AND ma.creator_id = current_profile_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "content_unlocks_insert_fan" ON content_unlocks
    FOR INSERT TO authenticated
    WITH CHECK (fan_id = current_profile_id());
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ========================
-- 9. CREATE tribute_scores
-- ========================
CREATE TABLE IF NOT EXISTS tribute_scores (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dom_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_score     INTEGER     NOT NULL DEFAULT 0,
  spend_score     INTEGER     NOT NULL DEFAULT 0,
  task_score      INTEGER     NOT NULL DEFAULT 0,
  tenure_score    INTEGER     NOT NULL DEFAULT 0,
  diversity_score INTEGER     NOT NULL DEFAULT 0,
  tier            TEXT        NOT NULL DEFAULT 'UNVERIFIED',
  month_year      TEXT        NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(fan_id, dom_id, month_year)
);

ALTER TABLE tribute_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "tribute_scores_select_fan" ON tribute_scores
    FOR SELECT TO authenticated
    USING (fan_id = current_profile_id());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "tribute_scores_select_dom" ON tribute_scores
    FOR SELECT TO authenticated
    USING (dom_id = current_profile_id());
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ========================
-- 10. (enums already created in step 3)
-- ========================


-- ========================
-- 11. CREATE vip_tiers
-- ========================
CREATE TABLE IF NOT EXISTS vip_tiers (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  dom_id           UUID           NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier_type        vip_tier_type  NOT NULL,
  threshold_type   threshold_type NOT NULL,
  threshold_value  NUMERIC        NOT NULL,
  reset_day        INTEGER        DEFAULT 1,
  created_at       TIMESTAMPTZ    DEFAULT now(),
  updated_at       TIMESTAMPTZ    DEFAULT now(),
  UNIQUE(dom_id, tier_type)
);

ALTER TABLE vip_tiers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "vip_tiers_select_dom" ON vip_tiers
    FOR SELECT TO authenticated
    USING (dom_id = current_profile_id());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "vip_tiers_insert_dom" ON vip_tiers
    FOR INSERT TO authenticated
    WITH CHECK (dom_id = current_profile_id());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "vip_tiers_update_dom" ON vip_tiers
    FOR UPDATE TO authenticated
    USING (dom_id = current_profile_id());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "vip_tiers_delete_dom" ON vip_tiers
    FOR DELETE TO authenticated
    USING (dom_id = current_profile_id());
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ========================
-- 12. CREATE vip_messages
-- ========================
CREATE TABLE IF NOT EXISTS vip_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dom_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vip_messages ENABLE ROW LEVEL SECURITY;

-- VIP members (granted chat_access) and the dom can read
DO $$ BEGIN
  CREATE POLICY "vip_messages_select_vip" ON vip_messages
    FOR SELECT TO authenticated
    USING (
      dom_id = current_profile_id()
      OR EXISTS (
        SELECT 1 FROM chat_access ca
        WHERE ca.creator_id = vip_messages.dom_id
          AND ca.fan_id = current_profile_id()
          AND ca.state = 'granted'
          AND ca.access_until > now()
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Dom + VIP members can insert
DO $$ BEGIN
  CREATE POLICY "vip_messages_insert_vip" ON vip_messages
    FOR INSERT TO authenticated
    WITH CHECK (
      sender_id = current_profile_id()
      AND (
        dom_id = current_profile_id()
        OR EXISTS (
          SELECT 1 FROM chat_access ca
          WHERE ca.creator_id = vip_messages.dom_id
            AND ca.fan_id = current_profile_id()
            AND ca.state = 'granted'
            AND ca.access_until > now()
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ========================
-- 13. ALTER chat_access
-- (access_until already exists — skip)
-- ========================
ALTER TABLE chat_access
  ADD COLUMN IF NOT EXISTS tier          TEXT    DEFAULT 'GROUP',
  ADD COLUMN IF NOT EXISTS rank_at_grant INTEGER;


-- ========================
-- 14. ALTER purchases
-- Migrate profile_id → fan_id, drop old payment columns
-- ========================

-- Add new columns first
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS fan_id        UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS usdc_tx_hash  TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS amount_usdc   NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS purchase_type TEXT;

-- Drop old RLS policies that reference columns we are about to drop
DROP POLICY IF EXISTS "purchases_select_own" ON purchases;
DROP POLICY IF EXISTS "purchases_select_creator" ON purchases;

-- Migrate profile_id → fan_id (if profile_id still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchases' AND column_name = 'profile_id'
  ) THEN
    UPDATE purchases SET fan_id = profile_id WHERE fan_id IS NULL;
  END IF;
END $$;

-- Drop old columns if they still exist
ALTER TABLE purchases
  DROP COLUMN IF EXISTS processor,
  DROP COLUMN IF EXISTS processor_tx_id,
  DROP COLUMN IF EXISTS amount_cents,
  DROP COLUMN IF EXISTS profile_id;

-- Recreate purchases RLS with new column names
DO $$ BEGIN
  CREATE POLICY "purchases_select_own" ON purchases
    FOR SELECT TO authenticated
    USING (fan_id = current_profile_id());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "purchases_select_creator" ON purchases
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.id::text = purchases.task_id
          AND t.creator_id = current_profile_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Drop old processor enum (safe — column already dropped)
DO $$ BEGIN
  DROP TYPE processor;
EXCEPTION WHEN undefined_object THEN null;
         WHEN dependent_objects_still_exist THEN null; END $$;

-- ========================
-- 15. CREATE recalculate_tribute_score()
-- ========================
CREATE OR REPLACE FUNCTION recalculate_tribute_score(p_fan_id UUID, p_dom_id UUID)
RETURNS void AS $$
DECLARE
  v_spend_usdc    NUMERIC;
  v_task_count    INTEGER;
  v_first_payment TIMESTAMPTZ;
  v_unique_doms   INTEGER;
  v_month         TEXT := to_char(now(), 'YYYY-MM');
BEGIN
  -- Lifetime spend with this dom (approved completions only)
  SELECT COALESCE(SUM(tc.amount_usdc), 0)
  INTO v_spend_usdc
  FROM task_completions tc
  JOIN tasks t ON tc.task_id = t.id
  WHERE tc.fan_id = p_fan_id
    AND t.creator_id = p_dom_id
    AND tc.status = 'APPROVED';

  -- Approved task completions with this dom
  SELECT COUNT(*)
  INTO v_task_count
  FROM task_completions tc
  JOIN tasks t ON tc.task_id = t.id
  WHERE tc.fan_id = p_fan_id
    AND t.creator_id = p_dom_id
    AND tc.status = 'APPROVED';

  -- Tenure: when fan first had any approved completion with any dom
  SELECT MIN(created_at) INTO v_first_payment
  FROM task_completions
  WHERE fan_id = p_fan_id AND status = 'APPROVED';

  -- Diversity: unique doms the fan has paid (approved completions)
  SELECT COUNT(DISTINCT t.creator_id)
  INTO v_unique_doms
  FROM task_completions tc
  JOIN tasks t ON tc.task_id = t.id
  WHERE tc.fan_id = p_fan_id AND tc.status = 'APPROVED';

  INSERT INTO tribute_scores (
    fan_id, dom_id,
    spend_score, task_score, tenure_score, diversity_score,
    total_score, month_year
  )
  VALUES (
    p_fan_id, p_dom_id,
    LEAST(FLOOR(v_spend_usdc * 10)::INTEGER, 500),
    LEAST(v_task_count * 30, 300)::INTEGER,
    LEAST(
      EXTRACT(EPOCH FROM (now() - COALESCE(v_first_payment, now()))) / 86400,
      100
    )::INTEGER,
    LEAST(v_unique_doms * 10, 100)::INTEGER,
    0,
    v_month
  )
  ON CONFLICT (fan_id, dom_id, month_year) DO UPDATE SET
    spend_score     = EXCLUDED.spend_score,
    task_score      = EXCLUDED.task_score,
    tenure_score    = EXCLUDED.tenure_score,
    diversity_score = EXCLUDED.diversity_score,
    updated_at      = now();

  -- Compute total from individual components
  UPDATE tribute_scores
  SET total_score = spend_score + task_score + tenure_score + diversity_score
  WHERE fan_id = p_fan_id AND dom_id = p_dom_id AND month_year = v_month;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ========================
-- 16. CREATE recalculate_vip_access()
-- ========================
CREATE OR REPLACE FUNCTION recalculate_vip_access(p_dom_id UUID)
RETURNS void AS $$
DECLARE
  v_month         TEXT        := to_char(now(), 'YYYY-MM');
  v_month_end     TIMESTAMPTZ := date_trunc('month', now()) + interval '1 month' - interval '1 second';
  v_group_tier    RECORD;
  v_private_tier  RECORD;
  v_total_subs    INTEGER;
  v_group_cutoff  INTEGER;
  v_private_cutoff INTEGER;
BEGIN
  SELECT * INTO v_group_tier   FROM vip_tiers WHERE dom_id = p_dom_id AND tier_type = 'GROUP';
  SELECT * INTO v_private_tier FROM vip_tiers WHERE dom_id = p_dom_id AND tier_type = 'PRIVATE';

  SELECT COUNT(DISTINCT fan_id) INTO v_total_subs
  FROM tribute_scores
  WHERE dom_id = p_dom_id AND month_year = v_month;

  -- Expire all current access for this dom
  UPDATE chat_access
  SET state = 'expired', updated_at = now()
  WHERE creator_id = p_dom_id AND state = 'granted';

  -- Grant GROUP access
  IF v_group_tier IS NOT NULL THEN
    IF v_group_tier.threshold_type = 'TOP_PERCENT' THEN
      v_group_cutoff := GREATEST(1, FLOOR(v_total_subs * v_group_tier.threshold_value / 100))::INTEGER;
    ELSE
      v_group_cutoff := v_group_tier.threshold_value::INTEGER;
    END IF;

    INSERT INTO chat_access (fan_id, creator_id, tier, state, access_until, rank_at_grant, updated_at)
    SELECT
      ts.fan_id,
      p_dom_id,
      'GROUP',
      'granted',
      v_month_end,
      ROW_NUMBER() OVER (ORDER BY ts.total_score DESC),
      now()
    FROM tribute_scores ts
    WHERE ts.dom_id = p_dom_id AND ts.month_year = v_month
    ORDER BY ts.total_score DESC
    LIMIT v_group_cutoff
    ON CONFLICT (fan_id, creator_id) DO UPDATE SET
      tier          = EXCLUDED.tier,
      state         = 'granted',
      access_until  = EXCLUDED.access_until,
      rank_at_grant = EXCLUDED.rank_at_grant,
      updated_at    = now();
  END IF;

  -- Grant PRIVATE access (always TOP_N)
  IF v_private_tier IS NOT NULL THEN
    v_private_cutoff := v_private_tier.threshold_value::INTEGER;

    INSERT INTO chat_access (fan_id, creator_id, tier, state, access_until, rank_at_grant, updated_at)
    SELECT
      ts.fan_id,
      p_dom_id,
      'PRIVATE',
      'granted',
      v_month_end,
      ROW_NUMBER() OVER (ORDER BY ts.total_score DESC),
      now()
    FROM tribute_scores ts
    WHERE ts.dom_id = p_dom_id AND ts.month_year = v_month
    ORDER BY ts.total_score DESC
    LIMIT v_private_cutoff
    ON CONFLICT (fan_id, creator_id) DO UPDATE SET
      tier          = EXCLUDED.tier,
      state         = 'granted',
      access_until  = EXCLUDED.access_until,
      rank_at_grant = EXCLUDED.rank_at_grant,
      updated_at    = now();
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ========================
-- 17. Trigger: recalculate score on task completion approval
-- ========================
CREATE OR REPLACE FUNCTION trg_recalculate_tribute_score()
RETURNS trigger AS $$
DECLARE
  v_dom_id UUID;
BEGIN
  -- Only fire when status transitions to APPROVED
  IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status <> 'APPROVED') THEN
    SELECT t.creator_id INTO v_dom_id
    FROM tasks t WHERE t.id = NEW.task_id;

    PERFORM recalculate_tribute_score(NEW.fan_id, v_dom_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_tribute_score_on_approval ON task_completions;
CREATE TRIGGER trg_tribute_score_on_approval
  AFTER UPDATE ON task_completions
  FOR EACH ROW
  EXECUTE FUNCTION trg_recalculate_tribute_score();

-- Also fire on INSERT (for CONTENT tasks that auto-approve)
DROP TRIGGER IF EXISTS trg_tribute_score_on_insert ON task_completions;
CREATE TRIGGER trg_tribute_score_on_insert
  AFTER INSERT ON task_completions
  FOR EACH ROW
  WHEN (NEW.status = 'APPROVED')
  EXECUTE FUNCTION trg_recalculate_tribute_score();


-- ========================
-- 18. CREATE indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_tasks_creator_id
  ON tasks(creator_id);

CREATE INDEX IF NOT EXISTS idx_task_completions_fan_status
  ON task_completions(fan_id, status);

CREATE INDEX IF NOT EXISTS idx_task_completions_task_id
  ON task_completions(task_id);

CREATE INDEX IF NOT EXISTS idx_tribute_scores_dom_month_score
  ON tribute_scores(dom_id, month_year, total_score DESC);

CREATE INDEX IF NOT EXISTS idx_tribute_scores_fan_id
  ON tribute_scores(fan_id);

CREATE INDEX IF NOT EXISTS idx_vip_messages_dom_id
  ON vip_messages(dom_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_unlocks_fan_media
  ON content_unlocks(fan_id, media_id);

CREATE INDEX IF NOT EXISTS idx_profiles_handle
  ON profiles(handle) WHERE handle IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_fan_id
  ON purchases(fan_id);


-- ========================
-- 19. Add tasks to Realtime publication
-- ========================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE task_completions;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE vip_messages;
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ========================
-- 20. ANALYZE updated tables
-- ========================
ANALYZE profiles;
ANALYZE tasks;
ANALYZE purchases;
ANALYZE task_completions;
ANALYZE tribute_scores;
ANALYZE vip_tiers;
ANALYZE vip_messages;
ANALYZE content_unlocks;
ANALYZE chat_access;
