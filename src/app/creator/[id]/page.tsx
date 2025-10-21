import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CreatorProfileView } from '@/components/creator/CreatorProfileView';

interface CreatorPageProps {
  params: Promise<{ id: string }>;
}

export default async function CreatorPage({ params }: CreatorPageProps) {
  const { id } = await params;
  const supabase = await createClient();

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
