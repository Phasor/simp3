import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@simp2/shared';
import { createClient } from '@supabase/supabase-js';

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
        { error: 'Not authorized to check this chat access' },
        { status: 403 }
      );
    }

    // Use service role to bypass RLS for access validation
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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
      updated_at: new Date().toISOString()
    };

    // Calculate access status
    let status: {
      hasAccess: boolean;
      isExpired: boolean;
      daysRemaining: number | null;
      minutesRemaining: number | null;
      lastQualifyingPurchaseId: string | null;
    } = {
      hasAccess: false,
      isExpired: true,
      daysRemaining: null,
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
        const minutesRemaining = Math.floor(timeDiff / (1000 * 60));
        
        status = {
          hasAccess: true,
          isExpired: false,
          daysRemaining,
          minutesRemaining,
          lastQualifyingPurchaseId: accessRecord.qualifying_purchase_id
        };
      }
    }

    return NextResponse.json({
      status,
      rules,
      error: null
    });

  } catch (error) {
    console.error('Error checking chat access:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
