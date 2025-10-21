import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
        { error: 'Not authorized to check this chat access' },
        { status: 403 }
      );
    }

    // Use service role to bypass RLS for access validation
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing required Supabase environment variables:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey
      });
      return NextResponse.json(
        { error: 'Server configuration error - missing Supabase credentials' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get chat access record
    const { data: accessRecord, error: accessError } = await supabaseAdmin
      .from('chat_access')
      .select('*')
      .eq('creator_id', creatorId)
      .eq('fan_id', fanId)
      .single();

    // Get chat rules (with fallback to defaults)
    let rules = null;
    const { data: rulesData, error: rulesError } = await supabaseAdmin
      .from('chat_rules')
      .select('*')
      .eq('creator_id', creatorId)
      .single();

    if (rulesError && rulesError.code !== 'PGRST116') {
      console.log('Using default chat rules due to error:', rulesError.message);
    }

    rules = rulesData || {
      creator_id: creatorId,
      min_spend_cents: 10000, // $100 default
      access_window_days: 30,  // 30 days default
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      access_days: 30
    };

    // Calculate access status
    let status: {
      hasAccess: boolean;
      accessUntil: Date | null;
      isExpired: boolean;
      timeRemaining: number | null;
      daysRemaining: number | null;
      hoursRemaining: number | null;
      minutesRemaining: number | null;
      lastQualifyingPurchaseId: string | null;
    } = {
      hasAccess: false,
      accessUntil: null,
      isExpired: true,
      timeRemaining: null,
      daysRemaining: null,
      hoursRemaining: null,
      minutesRemaining: null,
      lastQualifyingPurchaseId: null
    };

    if (accessRecord && accessRecord.state === 'granted') {
      const accessUntil = new Date(accessRecord.access_until);
      const now = new Date();
      const isExpired = accessUntil < now;
      
      if (!isExpired) {
        const timeDiff = accessUntil.getTime() - now.getTime();
        const daysRemaining = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hoursRemaining = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutesRemaining = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        
        status = {
          hasAccess: true,
          accessUntil,
          isExpired: false,
          timeRemaining: timeDiff,
          daysRemaining,
          hoursRemaining,
          minutesRemaining,
          lastQualifyingPurchaseId: accessRecord.last_qualifying_purchase_id
        };
      }
    }

    return NextResponse.json({
      status,
      rules,
      error: null
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });

  } catch (error) {
    console.error('Error checking chat access:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
