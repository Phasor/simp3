'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Star, Clock, DollarSign, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import type { Profile } from '@/lib/types/database';
import { getProfilePictureUrl } from '@/lib/utils/bunnynet';
import toast from 'react-hot-toast';

interface ChatRules {
  id: string;
  creator_id: string;
  min_spend_cents: number;
  access_days: number;
  access_window_days: number;
  created_at: string;
  updated_at: string;
}

interface CreatorProfileViewProps {
  creator: Profile;
  chatRules: ChatRules | null;
}

export function CreatorProfileView({ creator, chatRules }: CreatorProfileViewProps) {
  const { user, profile: currentProfile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const minSpendAmount = chatRules ? chatRules.min_spend_cents / 100 : 20;
  const accessDays = chatRules ? chatRules.access_days : 30;

  const handleGetChatAccess = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (!currentProfile) {
      router.push('/signup');
      return;
    }

    if (currentProfile.user_type === 'CREATOR') {
      toast.error('Creators cannot purchase chat access from other creators');
      return;
    }

    // For now, redirect to chat page - in a real app, this would go to a purchase flow
    toast.success('Redirecting to purchase flow...', { icon: '💳' });
    
    // In a real implementation, you'd redirect to a purchase/payment page
    // For now, we'll just redirect to the chat page
    setTimeout(() => {
      router.push('/chat');
    }, 1500);
  };

  const handleStartChat = () => {
    if (!user || !currentProfile) {
      router.push('/login');
      return;
    }

    // Redirect to chat with this creator
    router.push(`/chat?creator=${creator.id}&fan=${currentProfile.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-start gap-4">
          {/* Profile Picture */}
          <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
            <img
              src={getProfilePictureUrl(creator.profile_picture_url)}
              alt={creator.display_name}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/api/image/profile-pictures/default-avatar.jpg';
              }}
            />
          </div>

          {/* Creator Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{creator.display_name}</h1>
              <Star className="w-5 h-5 text-yellow-500 fill-current" />
            </div>
            <p className="text-gray-600 mb-3">Creator on CreatorHub</p>
            
            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <MessageCircle className="w-4 h-4" />
                <span>Available for chat</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{accessDays} days access</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Access Info */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Chat Access</h2>
        
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Unlock Private Messaging</h3>
              <p className="text-sm text-gray-600">Get direct access to chat with {creator.display_name}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-3 bg-white rounded-lg">
              <div className="flex items-center justify-center gap-1 text-lg font-bold text-green-600 mb-1">
                <DollarSign className="w-5 h-5" />
                {minSpendAmount}
              </div>
              <p className="text-xs text-gray-500">Minimum spend</p>
            </div>
            <div className="text-center p-3 bg-white rounded-lg">
              <div className="text-lg font-bold text-blue-600 mb-1">{accessDays} days</div>
              <p className="text-xs text-gray-500">Chat access</p>
            </div>
          </div>
          
          <ul className="text-sm text-gray-600 space-y-1 mb-4">
            <li>• Direct messaging with {creator.display_name}</li>
            <li>• Receive exclusive photos and videos</li>
            <li>• {accessDays} days of unlimited chat access</li>
            <li>• Real-time notifications</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {currentProfile?.id === creator.id ? (
            // If viewing own profile
            <div className="text-center py-4">
              <p className="text-gray-600 mb-3">This is your profile page</p>
              <button
                onClick={() => router.push('/chat')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Chat
              </button>
            </div>
          ) : user && currentProfile ? (
            // If logged in as different user
            <div className="space-y-2">
              <button
                onClick={handleGetChatAccess}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <DollarSign className="w-5 h-5" />
                    Get Chat Access (${minSpendAmount})
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
              
              <button
                onClick={handleStartChat}
                className="w-full py-2 px-6 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                View Existing Chat
              </button>
            </div>
          ) : (
            // If not logged in
            <div className="space-y-2">
              <button
                onClick={() => router.push('/signup')}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors"
              >
                <DollarSign className="w-5 h-5" />
                Sign Up to Get Access
                <ArrowRight className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => router.push('/login')}
                className="w-full py-2 px-6 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Already have an account? Sign In
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500">
        <p>Powered by CreatorHub</p>
      </div>
    </div>
  );
}
