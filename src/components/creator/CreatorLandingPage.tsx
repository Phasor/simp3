'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import type { Profile } from '@/lib/types/database';
import { getProfilePictureUrl, getBannerImageUrl } from '@/lib/utils/bunnynet';

interface ChatRules {
  id: string;
  creator_id: string;
  min_spend_cents: number;
  access_days: number;
  access_window_days: number;
  created_at: string;
  updated_at: string;
}

interface CreatorLandingPageProps {
  creator: Profile;
  chatRules: ChatRules | null;
}

export function CreatorLandingPage({ creator, chatRules }: CreatorLandingPageProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const minSpendAmount = chatRules ? chatRules.min_spend_cents / 100 : 100;
  const accessDays = chatRules ? chatRules.access_days : 30;

  // JSON-LD structured data for better SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": `Chat with ${creator.display_name || 'Creator'}`,
    "description": `Get exclusive one-on-one access to chat, photos, and updates directly from ${creator.display_name || 'this creator'}. Only limited spots available.`,
    "provider": {
      "@type": "Person",
      "name": creator.display_name || 'Creator',
      "image": getBannerImageUrl(creator.banner_image_url)
    },
    "offers": {
      "@type": "Offer",
      "price": minSpendAmount,
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "validFor": `P${accessDays}D`
    },
    "url": `https://simp3.app/creator/${creator.id}/landing`
  };

  // Banner image will be handled by the getBannerImageUrl utility function

  const handleChatClick = () => {
    setLoading(true);
    // Redirect to signup with creator reference and chat intent
    router.push(`/signup?ref=${creator.id}&intent=chat`);
  };

  return (
    <div className="bg-gradient-to-b from-white to-slate-50 text-slate-900 font-sans min-h-screen">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      <main className="max-w-3xl mx-auto px-4 py-12 text-center">
        {/* Hero profile section */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <img 
              src={getProfilePictureUrl(creator.profile_picture_url)} 
              className="h-40 w-40 rounded-full object-cover shadow-lg border-4 border-white" 
              alt="Creator avatar"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/api/image/profile-pictures/default-avatar.jpg';
              }}
            />
            <div className="absolute bottom-2 right-2 bg-emerald-500 h-4 w-4 rounded-full border-2 border-white" title="Online"></div>
          </div>
          <h1 className="mt-4 text-2xl font-bold">
            {creator.display_name || 'Creator'} <Star className="inline w-5 h-5 text-amber-500 fill-current" />
          </h1>
          <p className="text-sm text-slate-500">Creator on simp3 · Available now</p>
          
          {/* CTA Button above the fold */}
          <button
            onClick={handleChatClick}
            disabled={loading}
            className="mt-4 flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 font-medium"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                💬 Chat with me
              </>
            )}
          </button>
        </div>

        {/* Visual focus zone */}
        <div className="mt-8 rounded-2xl overflow-hidden shadow-xl border border-slate-200">
          <div className="w-full aspect-[1.91/1]">
            <img 
              src={getBannerImageUrl(creator.banner_image_url)} 
              className="w-full h-full object-cover" 
              alt="Preview image"
            />
          </div>
        </div>

        {/* About section */}
        {creator.about_text && (
          <section className="mt-8 max-w-3xl mx-auto px-4">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 text-center">About</h2>
            <p className="text-slate-700 text-lg leading-relaxed whitespace-pre-wrap text-justify">
              {creator.about_text}
            </p>
          </section>
        )}

        {/* Offer and CTA */}
        <section className="mt-8 bg-white border border-slate-200 rounded-2xl shadow p-6">
          <h2 className="text-lg font-semibold mb-3">Unlock Private Chat Access</h2>
          <p className="text-slate-600 text-sm max-w-md mx-auto">
            Get exclusive one-on-one access to chat, photos, and updates directly from{' '}
            <strong>{creator.display_name || 'this creator'}</strong>. Only limited spots available.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-4">
            <div className="rounded-xl border border-slate-200 px-6 py-4 bg-gradient-to-br from-slate-50 to-white">
              <p className="text-xs text-slate-500">Price</p>
              <p className="text-2xl font-bold mt-1">${minSpendAmount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 px-6 py-4 bg-gradient-to-br from-slate-50 to-white">
              <p className="text-xs text-slate-500">Access</p>
              <p className="text-2xl font-bold mt-1">{accessDays} days</p>
            </div>
          </div>

          <button 
            onClick={handleChatClick}
            disabled={loading}
            className="mt-8 w-full sm:w-auto bg-indigo-600 text-white font-semibold text-lg px-10 py-3 rounded-full shadow hover:bg-indigo-500 active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Loading...
              </div>
            ) : (
              '💬 Chat with me'
            )}
          </button>

          <p className="mt-4 text-xs text-slate-500">Secure and private · Cancel anytime</p>
        </section>

        {/* Social proof & urgency section */}
        <section className="mt-10 text-center">
          <p className="text-slate-600 text-sm">
            ⭐ Over <strong>1,200</strong> fans have already chatted with{' '}
            <strong>{creator.display_name || 'this creator'}</strong>
          </p>
          <p className="text-slate-500 text-xs mt-2 italic">
            "She replies fast and is super friendly!" — fan review
          </p>
        </section>
      </main>
    </div>
  );
}
