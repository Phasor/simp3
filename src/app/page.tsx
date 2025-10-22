import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import CreatorDashboard from '@/components/dashboard/CreatorDashboard';
import { calculateAccessStatus } from '@/lib/utils/chatAccess';
import { getProfilePictureUrl, getBannerImageUrl } from '@/lib/utils/bunnynet';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';

// Force dynamic rendering for user-specific content
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  // If no user, redirect to login
  if (!user || userError) redirect('/login');

  // Check if user has a profile
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  // If no profile exists, redirect to signup
  if (error || !profile) {
    redirect('/signup');
  }

  // If user is a creator, show the new dashboard
  if (profile.user_type === 'CREATOR') {
    return (
      <CreatorDashboard 
        creatorHandle={profile.id}
        displayName={profile.display_name || 'Creator'}
      />
    );
  }

  // For fans, fetch their active creators and trending creators
  const { data: chatAccessRecords } = await supabase
    .from('chat_access')
    .select(`
      *,
      creator:profiles!chat_access_creator_id_fkey(id, display_name, profile_picture_url, banner_image_url)
    `)
    .eq('fan_id', profile.id)
    .order('updated_at', { ascending: false });

  // Calculate active creators (those with current access)
  const activeCreators = chatAccessRecords?.filter(record => {
    const status = calculateAccessStatus(record);
    return status.hasAccess;
  }).map(record => ({
    ...record.creator,
    accessExpiresAt: record.access_until,
    daysRemaining: Math.ceil((new Date(record.access_until).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  })) || [];

  // Get trending creators (sorted by earnings in last month)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // First get all creators with their chat access records and purchases from last month
  const { data: creatorsWithEarnings } = await supabase
    .from('profiles')
    .select(`
      id, 
      display_name, 
      profile_picture_url, 
      banner_image_url,
      chat_access_creator:chat_access!chat_access_creator_id_fkey(
        last_qualifying_purchase_id,
        purchases:purchases!chat_access_last_qualifying_purchase_id_fkey(
          amount_cents,
          created_at
        )
      )
    `)
    .eq('user_type', 'CREATOR')
    .limit(20); // Get more to sort and then limit

  // Calculate monthly earnings and sort
  const trendingCreators = creatorsWithEarnings
    ?.map(creator => {
      const monthlyEarnings = creator.chat_access_creator
        ?.reduce((total, access) => {
          if (access.purchases && new Date(access.purchases.created_at) >= thirtyDaysAgo) {
            return total + (access.purchases.amount_cents || 0);
          }
          return total;
        }, 0) || 0;
      
      return {
        ...creator,
        monthlyEarnings
      };
    })
    .sort((a, b) => b.monthlyEarnings - a.monthlyEarnings)
    .slice(0, 8) || []; // Show 8 creators (2 rows of 4)

  return (
    <div className="bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900 font-sans min-h-screen">
      <main className="max-w-6xl mx-auto px-4 py-10">
        <h2 className="typ-h1 mb-8 text-center text-slate-900">
          Welcome back, <span className="text-primary-600">{profile.display_name || 'Fan'}!</span>
        </h2>

        {/* Active Creators Section */}
        <section className="mb-12">
          <h3 className="typ-h3 mb-3 text-slate-900">Your Active Creators</h3>
          {activeCreators.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {activeCreators.map((creator) => (
                <Link 
                  key={creator.id} 
                  href={`/chat?creator=${creator.id}`}
                  className="bg-white rounded-2xl overflow-hidden shadow group hover:shadow-lg transition-all duration-200 cursor-pointer"
                >
                  <ImageWithFallback
                    src={creator.banner_image_url ? getBannerImageUrl(creator.banner_image_url, { width: 400, height: 250 }) : `https://placehold.co/400x250/jpg?text=${encodeURIComponent(creator.display_name || 'Creator')}`}
                    fallbackSrc={`https://placehold.co/400x250/jpg?text=${encodeURIComponent(creator.display_name || 'Creator')}`}
                    alt={creator.display_name || 'Creator'}
                    className="w-full h-40 object-cover group-hover:opacity-90 transition"
                    width={400}
                    height={250}
                  />
                  <div className="p-4">
                    <p className="typ-ui text-slate-900">{creator.display_name || 'Creator'}</p>
                    <p className="typ-caption mb-2">
                      {creator.daysRemaining > 0 ? `${creator.daysRemaining} days remaining` : 'Expired'}
                    </p>
                    <span className="typ-label text-primary-600">
                      Open Chat →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow p-8 text-center">
              <p className="typ-body text-slate-500 mb-4">You don't have access to any creators yet.</p>
              <Link 
                href="/creators" 
                className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors typ-ui"
              >
                Discover Creators
              </Link>
            </div>
          )}
        </section>

        {/* Trending Creators Section */}
        <section className="mb-12">
          <h3 className="typ-h3 mb-3 text-slate-900">Trending Creators</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {trendingCreators?.map((creator, index) => (
              <Link 
                key={creator.id} 
                href={`/creator/${creator.id}/landing`}
                className="bg-white rounded-2xl overflow-hidden shadow group hover:shadow-lg transition-all duration-200 cursor-pointer"
              >
                <ImageWithFallback
                  src={creator.banner_image_url ? getBannerImageUrl(creator.banner_image_url, { width: 400, height: 250 }) : `https://placehold.co/400x250/jpg?text=${encodeURIComponent(creator.display_name || 'Creator')}`}
                  fallbackSrc={`https://placehold.co/400x250/jpg?text=${encodeURIComponent(creator.display_name || 'Creator')}`}
                  alt={creator.display_name || 'Creator'}
                  className="w-full h-40 object-cover group-hover:opacity-90 transition"
                  width={400}
                  height={250}
                />
                <div className="p-4">
                  <p className="typ-ui text-slate-900">{creator.display_name || 'Creator'}</p>
                  <p className="typ-caption mb-2">
                    {creator.monthlyEarnings > 0 
                      ? `💰 $${(creator.monthlyEarnings / 100).toFixed(0)} this month`
                      : index === 0 ? '🔥 Top Earner' : '⭐ Rising Star'
                    }
                  </p>
                  <span className="typ-label text-primary-600">
                    View Profile →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}