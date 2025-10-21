import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profile || profile.user_type !== 'CREATOR') {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 });
    }

    // Get all chat access records for this creator to find qualifying purchases
    const { data: chatAccessRecords, error: accessError } = await supabase
      .from('chat_access')
      .select('last_qualifying_purchase_id')
      .eq('creator_id', profile.id)
      .not('last_qualifying_purchase_id', 'is', null);

    if (accessError) {
      console.error('Error fetching chat access:', accessError);
      return NextResponse.json({ error: 'Failed to fetch access records' }, { status: 500 });
    }

    // Get all purchases that granted access to this creator
    const purchaseIds = chatAccessRecords
      ?.map(record => record.last_qualifying_purchase_id)
      .filter(Boolean) || [];

    if (purchaseIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data: purchases, error: purchaseError } = await supabase
      .from('purchases')
      .select(`
        *,
        profile:profiles!purchases_profile_id_fkey(id, display_name, email)
      `)
      .in('id', purchaseIds)
      .order('created_at', { ascending: false });

    if (purchaseError) {
      console.error('Error fetching purchases:', purchaseError);
      return NextResponse.json({ error: 'Failed to fetch purchases' }, { status: 500 });
    }

    // Format data for CSV export
    const exportData = purchases?.map(purchase => ({
      created_at: purchase.created_at,
      amount_cents: purchase.amount_cents,
      fan_username: purchase.profile?.display_name || purchase.profile?.email?.split('@')[0] || 'Unknown',
      processor: purchase.processor,
      processor_tx_id: purchase.processor_tx_id
    })) || [];

    return NextResponse.json(exportData);

  } catch (error) {
    console.error('Earnings export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
