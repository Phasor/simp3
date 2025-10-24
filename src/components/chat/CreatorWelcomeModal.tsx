'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, Share2, X, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { getProfilePictureUrl } from '@/lib/utils/bunnynet';
import toast from 'react-hot-toast';

interface CreatorWelcomeModalProps {
  onClose: () => void;
}

export function CreatorWelcomeModal({ onClose }: CreatorWelcomeModalProps) {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [tweetCopied, setTweetCopied] = useState(false);
  const router = useRouter();

  // Simple confetti effect
  useEffect(() => {
    const spawnConfetti = () => {
      const colors = ['#ffffff','#fef08a','#93c5fd','#fbcfe8','#a7f3d0'];
      for (let i = 0; i < 40; i++) {
        const el = document.createElement('div');
        el.className = 'fixed w-1.5 h-2.5 opacity-90 pointer-events-none z-50';
        el.style.left = Math.random() * 100 + 'vw';
        el.style.top = '-10px';
        el.style.background = colors[Math.floor(Math.random() * colors.length)];
        el.style.transform = `rotate(${Math.random() * 360}deg)`;
        el.style.animation = `fall ${2 + Math.random() * 2}s linear forwards`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 4000);
      }
    };
    
    // Add keyframes for confetti animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fall {
        to {
          transform: translateY(120vh) rotate(360deg);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
    
    spawnConfetti();
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (!profile || profile.user_type !== 'CREATOR') {
    return null;
  }

  // Generate the promotional link - fans can visit this to see the creator's profile
  const creatorLink = `${window.location.origin}/creator/${profile.id}/landing`;
  const displayName = profile.display_name || 'Creator';
  const username = profile.display_name?.toLowerCase().replace(/\s+/g, '') || 'creator';
  const avatar = profile.profile_picture_url 
    ? getProfilePictureUrl(profile.profile_picture_url)
    : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`;

  // Compose Tweet
  const tweetText = `I just opened my paid chat on @simpapp — come say hi 👋`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(creatorLink)}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(creatorLink);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const copyTweetText = async () => {
    try {
      await navigator.clipboard.writeText(`${tweetText} ${creatorLink}`);
      setTweetCopied(true);
      toast.success('Tweet text copied');
      setTimeout(() => setTweetCopied(false), 2000);
    } catch {
      toast.error('Copy failed');
    }
  };

  const shareOnFacebook = () => {
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(creatorLink)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  const shareOnInstagram = async () => {
    try {
      await navigator.clipboard.writeText(`${tweetText} ${creatorLink}`);
      toast.success('Caption copied — paste in Instagram', { duration: 4000 });
    } catch {
      toast.error('Copy failed');
    }
  };

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ 
          title: 'Chat with me on Simp', 
          text: tweetText, 
          url: creatorLink 
        });
      } catch {
        // User cancelled or error occurred
      }
    } else {
      await navigator.clipboard.writeText(`${tweetText} ${creatorLink}`);
      toast.success('Copied — paste anywhere');
    }
  };

  const handleClose = () => {
    // Remove the welcome parameter from URL
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.delete('welcome');
    const newUrl = searchParams.toString() 
      ? `/chat?${searchParams.toString()}` 
      : '/chat';
    router.replace(newUrl);
    onClose();
  };

  const handleContinueToChat = () => {
    toast.success('Great! You can access this later in Creator > Promote');
    handleClose();
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-indigo-600 via-fuchsia-500 to-rose-500 flex items-center justify-center p-6 z-50">
      {/* Background decorative orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute -bottom-20 -right-16 w-[28rem] h-[28rem] rounded-full bg-black/10 blur-3xl"></div>
      </div>

      {/* Modal Card */}
      <div className="w-full max-w-xl">
        <div className="relative rounded-3xl bg-white/15 backdrop-blur-xl text-white shadow-2xl border border-white/15">
          {/* Header */}
          <div className="flex items-center gap-4 p-6 sm:p-8 border-b border-white/10">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl">🎉</div>
              <span className="absolute -right-1 -bottom-1 block w-3 h-3 rounded-full bg-blue-500 animate-pulse shadow-lg shadow-blue-500/50"></span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">Your Paid Chat is Live</h1>
              <p className="text-white/80 text-sm sm:text-base">Share your link now to get your first paid message today.</p>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* Personalization */}
            <div className="flex items-center gap-4">
              <div className="relative w-12 h-12 rounded-full ring-2 ring-white/30 overflow-hidden bg-white/20 flex items-center justify-center">
                {profile.profile_picture_url ? (
                  <img 
                    className="w-full h-full object-cover" 
                    src={avatar} 
                    alt="avatar"
                    onError={(e) => {
                      // Fallback to initials if image fails to load
                      console.log('🖼️ Profile picture failed to load:', avatar);
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `<span class="font-medium text-white text-lg">${displayName?.charAt(0)?.toUpperCase() || '?'}</span>`;
                      }
                    }}
                  />
                ) : (
                  <span className="font-medium text-white text-lg">
                    {displayName?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                )}
              </div>
              <div>
                <div className="text-sm text-white/70">Welcome</div>
                <div className="text-lg font-semibold">@{username}</div>
              </div>
            </div>

            {/* Link box */}
            <div>
              <label className="block text-sm text-white/80 mb-2">Your creator link</label>
              <div className="flex items-stretch gap-2">
                <input 
                  className="flex-1 rounded-xl bg-white/15 border border-white/20 px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40" 
                  readOnly 
                  value={creatorLink} 
                />
                <button 
                  onClick={copyToClipboard}
                  className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white text-gray-900 font-semibold px-4 py-3 hover:bg-white/90 active:scale-[0.98] transition-all"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <p className="mt-2 text-xs text-white/70">Tip: Pin this link to the top of your profile.</p>
            </div>

            {/* Big CTA */}
            <div className="rounded-2xl bg-white/10 border border-white/15 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-xl">Tweet your launch</h3>
                  <p className="text-white/80 text-sm mt-1">&quot;I just opened my paid chat — come say hi 👋&quot;</p>
                  <p className="text-emerald-200/90 text-xs mt-2">Creators who share now often receive their first paid chat within hours.</p>
                </div>
                <div className="hidden sm:block w-20 h-20 rounded-2xl bg-white/15 flex items-center justify-center text-3xl">💬</div>
              </div>
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <a 
                  href={tweetUrl}
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-center rounded-xl px-5 py-3 font-semibold bg-sky-400 hover:bg-sky-300 text-gray-900 shadow active:scale-[.99] transition-all"
                >
                  Tweet my link
                </a>
                <button 
                  onClick={copyTweetText}
                  className="rounded-xl px-5 py-3 font-semibold bg-white/20 hover:bg-white/25 border border-white/20 transition-colors"
                >
                  {tweetCopied ? 'Copied!' : 'Copy tweet text'}
                </button>
              </div>
            </div>

            {/* Other shares */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button 
                onClick={shareOnFacebook}
                className="rounded-xl bg-white/15 hover:bg-white/20 border border-white/20 px-4 py-3 text-center font-semibold transition-colors"
              >
                Share to Facebook
              </button>
              <button 
                onClick={shareOnInstagram}
                className="rounded-xl bg-white/15 hover:bg-white/20 border border-white/20 px-4 py-3 font-semibold transition-colors"
              >
                Share to Instagram
              </button>
              <button 
                onClick={handleWebShare}
                className="rounded-xl bg-white/15 hover:bg-white/20 border border-white/20 px-4 py-3 font-semibold transition-colors"
              >
                Share…
              </button>
            </div>

            {/* Footer actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="text-xs text-white/70">You can always find your link in <span className="font-semibold text-white">Creator &gt; Promote</span>.</div>
              <div className="flex gap-2">
                <button 
                  onClick={() => router.push('/')}
                  className="rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 px-4 py-2 font-semibold transition-colors"
                >
                  Go to dashboard
                </button>
                <button 
                  onClick={handleContinueToChat}
                  className="rounded-xl bg-white text-gray-900 px-4 py-2 font-semibold hover:bg-white/90 transition-colors"
                >
                  Continue to chat
                </button>
              </div>
            </div>
          </div>
        </div>
        <p className="text-center text-white/75 text-xs mt-4">
          Need help? <span className="underline decoration-white/40 cursor-pointer">Docs</span> • <span className="underline decoration-white/40 cursor-pointer">Support</span>
        </p>
      </div>
    </div>
  );
}
