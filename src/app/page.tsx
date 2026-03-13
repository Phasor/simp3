import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = await getServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('auth_user_id', session.user.id)
    .single();

  if (profile?.user_type === 'CREATOR') {
    redirect('/dashboard');
  }

  redirect('/home');
}
