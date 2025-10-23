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
    const supabase = createServerClient({
      cookies,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
