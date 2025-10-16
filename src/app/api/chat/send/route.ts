import { NextResponse } from 'next/server';
import { createServerClientStrict } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    console.log('🚀 POST /api/chat/send - Starting request');
    let body: {
      creatorId: string;
      fanId: string;
      content: string;
    };
    try {
      body = await request.json();
      console.log('📝 Request body:', { creatorId: body.creatorId, fanId: body.fanId, contentLength: body.content?.length });
    } catch (e) {
      console.error('❌ Failed to parse JSON body:', e);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { creatorId, fanId, content } = body;

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'Message content must be a string' }, { status: 400 });
    }

    // Validate required fields
    if (!creatorId || !fanId || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: creatorId, fanId, content' },
        { status: 400 }
      );
    }

    // Validate IDs are UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(creatorId) || !uuidRegex.test(fanId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }
    
    if (creatorId === fanId) {
      return NextResponse.json(
        { error: 'creatorId and fanId cannot be the same' },
        { status: 400 }
      );
    }

    // Validate content
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return NextResponse.json(
        { error: 'Message content cannot be empty' },
        { status: 400 }
      );
    }

    if (trimmedContent.length > 1000) {
      return NextResponse.json(
        { error: 'Message content too long (max 1000 characters)' },
        { status: 400 }
      );
    }

    // Get current user
    console.log('🔐 Getting current user...');
    const supabase = await createServerClientStrict();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ Authentication failed:', userError);
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    console.log('✅ User authenticated:', user.id);

    // Get user's profile
    console.log('👤 Getting user profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_type')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('❌ Profile lookup failed:', profileError);
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }
    console.log('✅ Profile found:', { id: profile.id, user_type: profile.user_type });

    // Verify conversation exists and user is a participant (don't trust client IDs)
    console.log('🔍 Verifying conversation membership...');
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, creator_id, fan_id')
      .eq('creator_id', creatorId)
      .eq('fan_id', fanId)
      .single();

    if (convError || !conversation) {
      console.error('❌ Conversation not found:', convError);
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify user is either the creator or fan in this conversation
    if (profile.id !== conversation.creator_id && profile.id !== conversation.fan_id) {
      return NextResponse.json(
        { error: 'Not authorized to send messages in this conversation' },
        { status: 403 }
      );
    }

    // Insert message - derive sender_id from authenticated user, ignore client-sent values
    console.log('💬 Inserting message...');
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        creator_id: conversation.creator_id,  // Use verified conversation data
        fan_id: conversation.fan_id,          // Use verified conversation data  
        sender_id: profile.id,                // Derive from authenticated user
        content: trimmedContent
      })
      .select('*')
      .single();

    if (messageError) {
      console.error('❌ Message insert failed:', messageError);
      console.error('SEND /api/chat/send error:', messageError?.message, messageError);
      let status = 500;
      let errorMessage = 'Failed to send message';
      if (messageError.code === 'PGRST301') {
        status = 403;
        errorMessage = 'Not authorized to send message or chat access expired';
      } else if (messageError.code === '23503' /* foreign_key_violation */) {
        status = 400;
        errorMessage = 'Invalid creatorId/fanId';
      } else if (messageError.code === '23514' /* check_violation */) {
        status = 400;
        errorMessage = 'Message failed validation';
      }
      return NextResponse.json(
        { error: errorMessage, details: messageError },
        { status }
      );
    }

    console.log('✅ Message inserted successfully:', { id: message.id, sender_id: message.sender_id });

    // Message delivery via postgres_changes (RLS-protected, durable)
    // No server-side broadcast needed - clients subscribe to postgres_changes
    console.log('✅ Message created', { id: message.id, sender_id: message.sender_id });

    return NextResponse.json({ success: true, message }, { 
      status: 201,
      headers: { 'Cache-Control': 'no-store' }
    });

    // ARCHITECTURE NOTES:
    // - Messages delivered via postgres_changes (durable, RLS-protected)
    // - No server broadcast needed for message content
    // - Broadcast channels reserved for ephemeral signals (typing, presence)
    // - RLS policies enforce both membership and active chat access

  } catch (error) {
    console.error('Error in send message API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
