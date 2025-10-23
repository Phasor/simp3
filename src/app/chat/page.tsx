import { redirect } from 'next/navigation';
import { FLAGS } from '@/lib/flags';
import { getServerSupabase } from '@/lib/supabase/server';
import ChatClient from './ChatClient';

// Force dynamic rendering for user-specific content
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function ChatPage() {
  if (!FLAGS.SERVER_AUTH_GATE) {
    return <ChatClient />;
  }

  try {
    const supabase = await getServerSupabase();

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
