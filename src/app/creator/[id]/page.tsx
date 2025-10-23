import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@/lib/supabase/server';
import { FLAGS } from '@/lib/flags';
import { CreatorProfileView } from '@/components/creator/CreatorProfileView';

interface CreatorPageProps {
  params: Promise<{ id: string }>;
}

export default async function CreatorPage({ params }: CreatorPageProps) {
  const { id } = await params;
  
  // Use flag-guarded server auth or fallback to existing logic
  let supabase, user, userError;
  
  if (FLAGS.SERVER_AUTH_GATE) {
    supabase = createServerClient({
      cookies,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    });
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      redirect(`/login?next=/creator/${id}`);
    }
    user = session.user;
    userError = null;
  } else {
    supabase = await createClient();
    const result = await supabase.auth.getUser();
    user = result.data.user;
    userError = result.error;
    
    if (!user || userError) {
      redirect('/login');
    }
  }

  // Get current user's profile
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  // Fetch creator profile
  const { data: creator, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .eq('user_type', 'CREATOR')
    .single();

  if (error || !creator) {
    notFound();
  }

  // SECURITY: Only allow creators to access their own profile settings
  if (!currentProfile || currentProfile.id !== creator.id || currentProfile.user_type !== 'CREATOR') {
    // Redirect unauthorized users to the public landing page
    redirect(`/creator/${id}/landing`);
  }

  // Fetch chat rules for this creator
  const { data: chatRules } = await supabase
    .from('chat_rules')
    .select('*')
    .eq('creator_id', id)
    .single();

  return (
    <div className="min-h-screen bg-gray-50">
      <CreatorProfileView creator={creator} chatRules={chatRules} />
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: CreatorPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: creator } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', id)
    .eq('user_type', 'CREATOR')
    .single();

  return {
    title: creator ? `${creator.display_name} - CreatorHub` : 'Creator Profile - CreatorHub',
    description: creator ? `Connect with ${creator.display_name} on CreatorHub` : 'Creator profile on CreatorHub',
  };
}
