-- Recommended Database Indexes for Chat Performance
-- These indexes optimize the conversations_with_last_message view and related queries
-- Run these in Supabase SQL Editor for production performance

-- Index for chat_messages lateral join in the view
-- Optimizes: ORDER BY created_at DESC in lateral join
CREATE INDEX IF NOT EXISTS idx_chat_messages_creator_fan_created_desc 
ON chat_messages (creator_id, fan_id, created_at DESC);

-- Index for chat_access lateral join in the view  
-- Optimizes: ORDER BY access_until DESC in lateral join
CREATE INDEX IF NOT EXISTS idx_chat_access_creator_fan_access_desc 
ON chat_access (creator_id, fan_id, access_until DESC);

-- Index for conversations ordered by creator_id
-- Optimizes: WHERE creator_id = ? ORDER BY last_message_at DESC
CREATE INDEX IF NOT EXISTS idx_conversations_creator_last_message_desc 
ON conversations (creator_id, created_at DESC, id);

-- Index for conversations ordered by fan_id
-- Optimizes: WHERE fan_id = ? ORDER BY last_message_at DESC  
CREATE INDEX IF NOT EXISTS idx_conversations_fan_last_message_desc 
ON conversations (fan_id, created_at DESC, id);

-- Additional helpful indexes for auth and profile lookups
-- Index for profile lookups by auth_user_id (if not already exists)
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id 
ON profiles (auth_user_id);

-- Index for profile lookups by user_type (for creator/fan filtering)
CREATE INDEX IF NOT EXISTS idx_profiles_user_type 
ON profiles (user_type);

-- Composite index for creator profiles
CREATE INDEX IF NOT EXISTS idx_profiles_creator_type_id 
ON profiles (user_type, id) WHERE user_type = 'CREATOR';

-- Performance Notes:
-- 1. These indexes will significantly speed up the conversations_with_last_message view
-- 2. The lateral joins will use the creator_fan_*_desc indexes for fast lookups
-- 3. The conversations indexes support both creator and fan perspective queries
-- 4. Monitor index usage with: SELECT * FROM pg_stat_user_indexes;
-- 5. Consider VACUUM ANALYZE after creating indexes on large tables
