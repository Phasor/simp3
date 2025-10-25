import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getBannerImageUrl } from '@/lib/utils/bunnynet';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';

// Force dynamic rendering for user-specific content
export const dynamic = 'force-dynamic';

export default async function CreatorsPage() {
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

  // Get all creators with their earnings data
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
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
    .limit(50); // Show more creators on this dedicated page

  // Calculate monthly earnings and sort
  const allCreators = creatorsWithEarnings
    ?.map(creator => {
      const monthlyEarnings = creator.chat_access_creator
        ?.reduce((total, access) => {
          if (access.purchases && Array.isArray(access.purchases)) {
            // Handle array case
            return total + access.purchases.reduce((sum: number, p: { created_at: string; amount_cents: number }) => {
              if (new Date(p.created_at) >= thirtyDaysAgo) {
                return sum + (p.amount_cents || 0);
              }
              return sum;
            }, 0);
          } else if (access.purchases && typeof access.purchases === 'object') {
            // Handle single object case
            const purchase = access.purchases as { created_at: string; amount_cents: number };
            if (new Date(purchase.created_at) >= thirtyDaysAgo) {
              return total + (purchase.amount_cents || 0);
            }
          }
          return total;
        }, 0) || 0;
      
      return {
        ...creator,
        monthlyEarnings
      };
    })
    .sort((a, b) => b.monthlyEarnings - a.monthlyEarnings) || [];

  return (
    <div className="bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900 font-sans min-h-screen">
      <main className="max-w-6xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="typ-h1 mb-4 text-slate-900">
            Discover Creators
          </h1>
          <p className="typ-body text-slate-600 max-w-2xl mx-auto">
            Browse all creators on CreatorHub. Find your favorites and unlock exclusive content through chat access.
          </p>
        </div>

        {/* Back to Dashboard Link */}
        <div className="mb-8">
          <Link 
            href="/"
            className="inline-flex items-center text-primary-600 hover:text-primary-700 transition-colors typ-ui"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* All Creators Grid */}
        <section>
          <h2 className="typ-h3 mb-6 text-slate-900">All Creators ({allCreators.length})</h2>
          
          {allCreators.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {allCreators.map((creator, index) => (
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
          ) : (
            <div className="bg-white rounded-xl shadow p-8 text-center">
              <p className="typ-body text-slate-500">No creators found.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
