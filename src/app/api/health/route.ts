import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const timestamp = new Date().toISOString();
  
  try {
    // Test Supabase connection
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('Health check - Supabase error:', error);
      return NextResponse.json({ 
        status: 'error', 
        timestamp,
        supabase: 'error',
        error: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      status: 'ok', 
      timestamp,
      supabase: 'connected',
      profileCount: data || 0
    });
  } catch (error) {
    console.error('Health check - Exception:', error);
    return NextResponse.json({ 
      status: 'error', 
      timestamp,
      supabase: 'exception',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
