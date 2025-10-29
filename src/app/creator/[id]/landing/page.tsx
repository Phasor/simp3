import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CreatorLandingPage } from '@/components/creator/CreatorLandingPage';

interface CreatorLandingPageProps {
  params: Promise<{ id: string }>;
}

export default async function CreatorLanding({ params }: CreatorLandingPageProps) {
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

  return <CreatorLandingPage creator={creator} chatRules={chatRules} />;
}

// Generate metadata for SEO and social sharing
export async function generateMetadata({ params }: CreatorLandingPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: creator } = await supabase
    .from('profiles')
    .select('display_name, banner_image_url, profile_picture_url')
    .eq('id', id)
    .eq('user_type', 'CREATOR')
    .single();

  // Get chat rules for pricing info
  const { data: chatRules } = await supabase
    .from('chat_rules')
    .select('min_spend_cents, access_days, time_unit')
    .eq('creator_id', id)
    .single();

  const creatorName = creator?.display_name || 'Creator';
  const price = chatRules ? `$${chatRules.min_spend_cents / 100}` : '$100';
  const accessDays = chatRules?.access_days || 30;
  const timeUnit = chatRules?.time_unit || 'days';
  
  // Format access duration for description
  const accessLabel = `${accessDays} ${timeUnit}`;
  
  const title = `Chat with ${creatorName} · simp3`;
  const description = `Get exclusive one-on-one access to chat, photos, and updates directly from ${creatorName}. ${accessLabel} access for ${price}. Limited spots available.`;
  
  // Use banner image if available, otherwise generate dynamic OG image
  let imageUrl: string;
  
  if (creator?.banner_image_url) {
    imageUrl = `https://simp3.b-cdn.net/${creator.banner_image_url}`;
  } else {
    // Generate dynamic OG image with creator info
    const ogParams = new URLSearchParams({
      creator: creatorName,
      price: price,
    });
    imageUrl = `https://simp3.app/api/og-image-default?${ogParams.toString()}`;
  }

  const landingPageUrl = `https://simp3.app/creator/${id}/landing`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: landingPageUrl,
      siteName: 'simp3',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630, // Twitter Large Card recommended size
          alt: `${creatorName} on simp3`,
        }
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
      creator: '@simp3app', // Replace with your actual Twitter handle
      site: '@simp3app', // Replace with your actual Twitter handle
    },
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: landingPageUrl,
    },
  };
}
