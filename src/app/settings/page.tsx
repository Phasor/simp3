import { redirect } from 'next/navigation';
import { FLAGS } from '@/lib/flags';
import { getServerSupabase } from '@/lib/supabase/server';
import SettingsClient from './SettingsClient';

export const runtime = 'nodejs';

export default async function SettingsPage() {
  if (!FLAGS.SERVER_AUTH_GATE) {
    return <SettingsClient />;
  }

  try {
    const supabase = await getServerSupabase();

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      redirect('/login?next=/settings');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', session.user.id)
      .single();

    return <SettingsClient initialProfile={profile ?? null} />;
  } catch (error) {
    console.error('Settings page error:', error);
    redirect('/login?next=/settings');
  }
}
