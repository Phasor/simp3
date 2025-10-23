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
