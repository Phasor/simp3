import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await getServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type, display_name')
    .eq('auth_user_id', session.user.id)
    .single();

  if (!profile || profile.user_type !== 'CREATOR') {
    redirect('/profile');
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Dom Dashboard</h1>
        <p className="text-gray-400">
          Welcome back{profile.display_name ? `, ${profile.display_name}` : ''}.
          Full dashboard coming in Phase 3.
        </p>
      </div>
    </div>
  );
}
