-- Performance indexes for chat_access table
-- These indexes improve query performance for getUserChatAccess function
-- Run these in your Supabase SQL Editor

-- Index for queries filtering by creator_id and ordering by updated_at
-- Used when a creator views their fan list with access status
CREATE INDEX IF NOT EXISTS chat_access_creator_updated_idx 
ON chat_access (creator_id, updated_at DESC);

-- Index for queries filtering by fan_id and ordering by updated_at  
-- Used when a fan views their list of creators they have access to
CREATE INDEX IF NOT EXISTS chat_access_fan_updated_idx 
ON chat_access (fan_id, updated_at DESC);

-- Composite index for fast lookups by both creator_id and fan_id
-- Used for checking specific conversation access
CREATE INDEX IF NOT EXISTS chat_access_creator_fan_idx
ON chat_access (creator_id, fan_id);

-- Index for state queries (to quickly filter active/expired access)
CREATE INDEX IF NOT EXISTS chat_access_state_idx
ON chat_access (state);

-- Analyze the table to update statistics for the query planner
ANALYZE chat_access;

