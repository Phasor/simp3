'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Copy, Check, Share2, X, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import toast from 'react-hot-toast';

interface CreatorWelcomeProps {
  onClose: () => void;
}

export function CreatorWelcome({ onClose }: CreatorWelcomeProps) {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  if (!profile || profile.user_type !== 'CREATOR') {
    return null;
  }

  // Generate the promotional link - fans can visit this to see the creator's profile
  const promotionalLink = `${window.location.origin}/creator/${profile.id}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(promotionalLink);
      setCopied(true);
      toast.success('Link copied to clipboard!', { icon: '📋' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const shareOnSocial = (platform: string) => {
    const text = `Check out my profile on CreatorHub! 💫`;
    const url = promotionalLink;
    
    let shareUrl = '';
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case 'instagram':
        // Instagram doesn't support direct URL sharing, so we'll copy the link
        copyToClipboard();
        toast.success('Link copied! Paste it in your Instagram bio or story', { 
          icon: '📸',
          duration: 4000 
        });
        return;
      default:
        return;
    }
    
    window.open(shareUrl, '_blank', 'width=600,height=400');
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Welcome content */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🎉</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to CreatorHub!
          </h2>
          <p className="text-gray-600">
            Your creator account is ready! Share your promotional link to start connecting with fans.
          </p>
        </div>

        {/* Promotional link section */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Promotional Link
          </label>
          <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <input
              type="text"
              value={promotionalLink}
              readOnly
              className="flex-1 bg-transparent text-sm text-gray-700 outline-none"
            />
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Share this link on social media to let fans discover your profile
          </p>
        </div>

        {/* Social sharing buttons */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Share on social media:</p>
          <div className="flex gap-2">
            <button
              onClick={() => shareOnSocial('twitter')}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Twitter
            </button>
            <button
              onClick={() => shareOnSocial('facebook')}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-blue-700 text-white rounded hover:bg-blue-800 transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Facebook
            </button>
            <button
              onClick={() => shareOnSocial('instagram')}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded hover:from-purple-600 hover:to-pink-600 transition-colors text-sm"
            >
              <Share2 className="w-4 h-4" />
              Instagram
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            Continue to Chat
          </button>
          <button
            onClick={() => {
              copyToClipboard();
              handleClose();
            }}
            className="flex-1 py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Copy & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
