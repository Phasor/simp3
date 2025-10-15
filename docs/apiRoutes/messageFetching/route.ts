import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@simp2/shared';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ creatorId: string; fanId: string }> }
) {
  try {
    const { creatorId, fanId } = await params;

    if (!creatorId || !fanId) {
      return NextResponse.json(
        { error: 'Missing creatorId or fanId' },
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

    // Get current user
    const supabase = await createSupabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_type')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Verify user is either the creator or fan in this conversation
    if (profile.id !== creatorId && profile.id !== fanId) {
      return NextResponse.json(
        { error: 'Not authorized to view this conversation' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get('limit'));
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
    const beforeRaw = url.searchParams.get('before');
    const before =
      beforeRaw && !Number.isNaN(Date.parse(beforeRaw))
        ? new Date(beforeRaw).toISOString()
        : undefined;

    // Use simple creator_id + fan_id query (reliable and works with RLS)
    // This is more reliable than depending on conversation_id function
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('creator_id', creatorId)
      .eq('fan_id', fanId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }) // tiebreaker for stable pagination
      .limit(limit);

    // Add pagination if before timestamp provided
    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      const status = messagesError.code === 'PGRST301' ? 403 : 500;
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status }
      );
    }

    // Reverse to get chronological order (oldest first)
    // Don't mutate original array to preserve cursor calculation
    const desc = messages ?? [];
    const sortedMessages = [...desc].reverse();

    // Get pagination info
    const hasMore = desc.length === limit;
    const tail = hasMore ? desc[desc.length - 1] : null;
    const nextCursor = tail ? tail.created_at : null;
    const nextCursorId = tail ? tail.id : null;

    return NextResponse.json({
      messages: sortedMessages,
      pagination: {
        hasMore,
        nextCursor,
        nextCursorId // optional; client may ignore for MVP
      }
    });

  } catch (error) {
    console.error('Error in fetch messages API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
