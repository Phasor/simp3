import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { FLAGS } from '@/lib/flags';
import ChatClient from './ChatClient';

// Force dynamic rendering for user-specific content
export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  if (!FLAGS.SERVER_AUTH_GATE) {
    return <ChatClient />;
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');

    const supabase = createServerClient({
      cookies,
      supabaseUrl,
      supabaseKey,
    });

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      redirect('/login?next=/chat');
    }

    return <ChatClient />;
  } catch (error) {
    console.error('Chat page error:', error);
    redirect('/login?next=/chat');
  }
}
