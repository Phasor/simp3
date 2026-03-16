import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';

// POST /api/chat/start  { domId: string }
// Creates a conversation row if it doesn't exist, returns { conversation }
export async function POST(req: NextRequest) {
  try {
    const { domId } = await req.json();
    if (!domId) return NextResponse.json({ error: 'domId required' }, { status: 400 });

    // Use getSession (reads from cookie — no network round-trip)
    const supabase = await getServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Use admin client for all DB queries — bypasses RLS, no auth timing issues
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get fan profile by auth_user_id
    const { data: profile } = await admin
      .from('profiles')
      .select('id, user_type')
      .eq('auth_user_id', session.user.id)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    if (profile.user_type !== 'FAN') return NextResponse.json({ error: 'Only subs can start conversations' }, { status: 403 });

    const fanId = profile.id;

    // Verify VIP access
    const { data: access } = await admin
      .from('chat_access')
      .select('id')
      .eq('fan_id', fanId)
      .eq('creator_id', domId)
      .eq('state', 'granted')
      .gt('access_until', new Date().toISOString())
      .maybeSingle();

    if (!access) return NextResponse.json({ error: 'No VIP access to this dom' }, { status: 403 });

    // Upsert conversation — idempotent
    const { data: existing } = await admin
      .from('conversations')
      .select('id, creator_id, fan_id')
      .eq('creator_id', domId)
      .eq('fan_id', fanId)
      .maybeSingle();

    let conversation = existing;
    if (!conversation) {
      const { data: created, error: insertErr } = await admin
        .from('conversations')
        .insert({ creator_id: domId, fan_id: fanId })
        .select('id, creator_id, fan_id')
        .single();
      if (insertErr) throw insertErr;
      conversation = created;
    }

    return NextResponse.json({ conversation });
  } catch (err: unknown) {
    console.error('[chat/start]', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
