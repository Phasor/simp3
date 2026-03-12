-- Add about_text to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS about_text text;

-- media_assets (needed by tasks / payment flow)
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
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "media_assets_select_all" ON media_assets FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "media_assets_insert_own" ON media_assets FOR INSERT TO authenticated WITH CHECK (creator_id = current_profile_id()); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- tasks
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
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "tasks_select_all" ON tasks FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "tasks_insert_own" ON tasks FOR INSERT TO authenticated WITH CHECK (creator_id = current_profile_id()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "tasks_update_own" ON tasks FOR UPDATE TO authenticated USING (creator_id = current_profile_id()); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Allow creators to read purchases for their tasks (dashboard stats)
DO $$ BEGIN CREATE POLICY "purchases_select_creator" ON purchases FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id::text = purchases.task_id AND t.creator_id = current_profile_id())); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS tasks_creator_id_idx ON tasks(creator_id);
CREATE INDEX IF NOT EXISTS media_assets_creator_id_idx ON media_assets(creator_id);
