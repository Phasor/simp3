import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import ChatApp from './ChatApp';
import ClientProbe from './ClientProbe';
import type { ConversationServer } from '@/lib/types/chat';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function ChatPage() {
  const cookieStore = cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        async get(name: string) { return (await cookieStore).get(name)?.value; },
        async set(name: string, value: string, options?: Record<string, unknown>) {
          try { (await cookieStore).set(name, value, options); } catch {}
        },
        async remove(name: string, options?: Record<string, unknown>) {
          try { (await cookieStore).set(name, '', { ...options, maxAge: 0 }); } catch {}
        },
      },
    }
  );

  // Verify user on the server (authentic)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/chat');

  // Get user's profile to use profile ID for conversation queries
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (!profileRow) redirect('/profile');

  const profileId = profileRow.id;

  // SSR-fetch conversations with access status from view (one query!)
  let initialConversations: ConversationServer[] = [];
  
  try {
    const { data } = await supabase
      .from('conversations_inbox')  // ← Using the view with pre-computed access
      .select(`*,
        creator:profiles!conversations_creator_id_fkey(*),
        fan:profiles!conversations_fan_id_fkey(*)
      `)
      .or(`creator_id.eq.${profileId},fan_id.eq.${profileId}`)
      .order('created_at', { ascending: false })
      .limit(50);
    initialConversations = data ?? [];
  } catch (error) {
    console.error('Error fetching initial conversations:', error);
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900">
      <ChatApp initialConversations={initialConversations} initialUserId={profileId} />
      <ClientProbe />
    </div>
  );
}
