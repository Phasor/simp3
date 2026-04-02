import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';

// GET /api/chat/vip-doms
// Returns dom profiles the authenticated sub has VIP chat access to
export async function GET() {
  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ doms: [] });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, user_type')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile || profile.user_type !== 'FAN') return NextResponse.json({ doms: [] });

    // Use service role to avoid RLS timing issues
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: accessRows } = await admin
      .from('chat_access')
      .select('creator_id')
      .eq('fan_id', profile.id)
      .eq('state', 'granted');

    if (!accessRows?.length) return NextResponse.json({ doms: [] });

    const domIds = accessRows.map(r => r.creator_id);
    const { data: doms } = await admin
      .from('profiles')
      .select('*')
      .in('id', domIds);

    return NextResponse.json({ doms: doms ?? [] });
  } catch (err) {
    console.error('[chat/vip-doms]', err);
    return NextResponse.json({ doms: [] });
  }
}
