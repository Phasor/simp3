-- Migration: Create optimized view for conversations with last message and access status
-- This view combines conversations, profiles, last messages, and chat access in one query
-- to eliminate multiple round trips and improve chat inbox performance.

-- Drop the view first if it exists to avoid column conflicts
drop view if exists conversations_with_last_message;

create view conversations_with_last_message as
select
  c.id,
  c.creator_id,
  c.fan_id,
  c.created_at,
  c.updated_at,
  creator.id as creator_id_join, 
  creator.email as creator_email,
  creator.display_name as creator_display_name, 
  creator.user_type as creator_user_type, 
  creator.profile_picture_url as creator_ppu,
  fan.id as fan_id_join, 
  fan.email as fan_email,
  fan.display_name as fan_display_name, 
  fan.user_type as fan_user_type, 
  fan.profile_picture_url as fan_ppu,
  lm.id as last_message_id, 
  lm.sender_id as last_message_sender_id, 
  lm.content as last_message_content, 
  lm.created_at as last_message_created_at,
  coalesce(lm.created_at, c.created_at) as last_message_at,
  ca.id as access_id, 
  ca.access_until, 
  ca.created_at as access_created_at
from conversations c
join profiles creator on creator.id = c.creator_id
join profiles fan on fan.id = c.fan_id
left join lateral (
  select * from chat_messages m
  where m.creator_id = c.creator_id and m.fan_id = c.fan_id
  order by m.created_at desc
  limit 1
) lm on true
left join lateral (
  select * from chat_access a
  where a.creator_id = c.creator_id and a.fan_id = c.fan_id
  order by a.access_until desc nulls last
  limit 1
) ca on true;

-- Grant appropriate permissions
grant select on conversations_with_last_message to authenticated;
grant select on conversations_with_last_message to anon;
