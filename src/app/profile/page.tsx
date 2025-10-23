import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { FLAGS } from '@/lib/flags';
import ProfileClient from './ProfileClient';

export default async function ProfilePage() {
  if (!FLAGS.SERVER_AUTH_GATE) {
    return <ProfileClient />;
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies,
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      redirect('/login?next=/profile');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', session.user.id)
      .single();

    // Redirect creators to their creator page
    if (profile?.user_type === 'CREATOR') {
      redirect(`/creator/${profile.id}`);
    }

    return <ProfileClient initialProfile={profile ?? null} />;
  } catch (error) {
    console.error('Profile page error:', error);
    redirect('/login?next=/profile');
  }
}
