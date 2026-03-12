import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

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

    // Get current user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_type')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Verify user is either the creator or fan in this conversation
    if (profile.id !== creatorId && profile.id !== fanId) {
      return NextResponse.json({ error: 'Not authorized to check this chat access' }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createSupabaseClient(supabaseUrl, supabaseServiceKey);

    // Get chat access record
    const { data: accessRecord, error: accessError } = await supabaseAdmin
      .from('chat_access')
      .select('*')
      .eq('creator_id', creatorId)
      .eq('fan_id', fanId)
      .maybeSingle();

    if (accessError) {
      console.error('Error fetching chat access record:', accessError);
      return NextResponse.json({ error: 'Failed to fetch chat access' }, { status: 500 });
    }

    // Calculate access status
    let status = {
      hasAccess: false,
      accessUntil: null as Date | null,
      isExpired: true,
      timeRemaining: null as number | null,
      daysRemaining: null as number | null,
      hoursRemaining: null as number | null,
      minutesRemaining: null as number | null,
      lastQualifyingPurchaseId: null as string | null,
    };

    if (accessRecord && accessRecord.state === 'granted') {
      const accessUntil = new Date(accessRecord.access_until);
      const now = new Date();
      const isExpired = accessUntil < now;

      if (!isExpired) {
        const timeDiff = accessUntil.getTime() - now.getTime();
        status = {
          hasAccess: true,
          accessUntil,
          isExpired: false,
          timeRemaining: timeDiff,
          daysRemaining: Math.floor(timeDiff / (1000 * 60 * 60 * 24)),
          hoursRemaining: Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutesRemaining: Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60)),
          lastQualifyingPurchaseId: accessRecord.last_qualifying_purchase_id,
        };
      }
    }

    return NextResponse.json({ status, error: null }, {
      headers: { 'Cache-Control': 'no-store' }
    });

  } catch (error) {
    console.error('Error checking chat access:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
