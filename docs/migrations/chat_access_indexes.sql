-- Missing indexes for getUserChatAccess function performance
-- These indexes are specifically needed for the queries in ChatInbox

-- Index for creator chat access queries
-- Optimizes: WHERE creator_id = ? ORDER BY updated_at DESC
CREATE INDEX IF NOT EXISTS chat_access_creator_updated_idx 
ON chat_access (creator_id, updated_at DESC);

-- Index for fan chat access queries  
-- Optimizes: WHERE fan_id = ? ORDER BY updated_at DESC
CREATE INDEX IF NOT EXISTS chat_access_fan_updated_idx 
ON chat_access (fan_id, updated_at DESC);

-- Additional composite indexes for better performance
-- Index for creator + fan lookups (used in access validation)
CREATE INDEX IF NOT EXISTS chat_access_creator_fan_idx 
ON chat_access (creator_id, fan_id, updated_at DESC);

-- Index for active access queries (non-null access_until)
CREATE INDEX IF NOT EXISTS chat_access_active_until_idx 
ON chat_access (access_until DESC) WHERE access_until IS NOT NULL;

-- Performance notes:
-- 1. These indexes will eliminate the timeout in getUserChatAccess
-- 2. The creator_updated_idx and fan_updated_idx are critical for ChatInbox loading
-- 3. Run ANALYZE chat_access; after creating these indexes
-- 4. Monitor with: SELECT * FROM pg_stat_user_indexes WHERE relname = 'chat_access';
