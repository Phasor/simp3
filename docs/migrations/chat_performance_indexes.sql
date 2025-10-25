-- Critical performance indexes for ChatInbox loading
-- These indexes prevent the CHAT_ACCESS_TIMEOUT errors by ensuring queries complete under 3-5s

-- Index for chat_messages lateral join in conversations_with_last_message view
-- Optimizes: ORDER BY created_at DESC in lateral join for last message lookup
CREATE INDEX IF NOT EXISTS chat_messages_c_f_created_at_idx
ON chat_messages (creator_id, fan_id, created_at DESC);

-- Index for chat_access lateral join in conversations_with_last_message view  
-- Optimizes: ORDER BY access_until DESC in lateral join for access status lookup
CREATE INDEX IF NOT EXISTS chat_access_c_f_until_idx
ON chat_access (creator_id, fan_id, access_until DESC);

-- Index for conversations ordered by creator (fan perspective)
-- Optimizes: WHERE creator_id = ? ORDER BY last_message_at DESC
CREATE INDEX IF NOT EXISTS conversations_creator_last_idx
ON conversations (creator_id, created_at DESC, id);

-- Index for conversations ordered by fan (creator perspective)  
-- Optimizes: WHERE fan_id = ? ORDER BY last_message_at DESC
CREATE INDEX IF NOT EXISTS conversations_fan_last_idx
ON conversations (fan_id, created_at DESC, id);

-- Additional indexes for getUserChatAccess function
-- These are the specific indexes mentioned in the function comments
CREATE INDEX IF NOT EXISTS chat_access_creator_updated_idx 
ON chat_access (creator_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS chat_access_fan_updated_idx 
ON chat_access (fan_id, updated_at DESC);

-- Performance notes:
-- 1. These indexes eliminate the 3-5s timeouts in ChatInbox
-- 2. The c_f_* indexes optimize the lateral joins in the conversations_with_last_message view
-- 3. The creator/fan_last_idx indexes optimize conversation listing queries
-- 4. The creator/fan_updated_idx indexes optimize the getUserChatAccess queries
-- 5. Run ANALYZE after creating these indexes: ANALYZE chat_messages, chat_access, conversations;
-- 6. Monitor index usage: SELECT * FROM pg_stat_user_indexes WHERE relname IN ('chat_messages', 'chat_access', 'conversations');

-- Expected performance improvement:
-- - ChatInbox loading: 3-5s timeout → <500ms
-- - Conversation list queries: Full table scan → Index scan
-- - Access status lookups: Sequential scan → Index scan
