import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  try {
    const { creatorId } = await params;
    const supabase = await createClient();

    // Fetch chat rules for this creator
    const { data: chatRules, error } = await supabase
      .from('chat_rules')
      .select('*')
      .eq('creator_id', creatorId)
      .single();

    if (error) {
      // If no chat rules found, return defaults
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          creator_id: creatorId,
          min_spend_cents: 10000, // $100 default
          access_days: 30,
          access_window_days: 30,
          time_unit: 'days'
        });
      }
      
      console.error('Error fetching chat rules:', error);
      return NextResponse.json(
        { error: 'Failed to fetch chat rules' },
        { status: 500 }
      );
    }

    return NextResponse.json(chatRules);
  } catch (error) {
    console.error('Error in chat rules API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
