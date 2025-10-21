'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Star, Clock, DollarSign, ArrowRight, Settings, Edit, Save, X, Camera, User, Mail, Copy, Check } from 'lucide-react';
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Form state for editing
  const [displayName, setDisplayName] = useState(creator.display_name || '');
  const [email, setEmail] = useState(creator.email || '');
  const [profilePictureUrl, setProfilePictureUrl] = useState(creator.profile_picture_url || '');
  const [minSpendCents, setMinSpendCents] = useState(chatRules?.min_spend_cents || 2000);
  const [accessDays, setAccessDays] = useState(chatRules?.access_days || 30);

  const minSpendAmount = minSpendCents / 100;
  const displayMinSpendAmount = chatRules ? chatRules.min_spend_cents / 100 : 20;
  const displayAccessDays = chatRules ? chatRules.access_days : 30;
  
  // Generate permalink
  const permalink = `https://simp3.app/creator/${creator.id}`;

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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/profile-picture', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setProfilePictureUrl(data.url);
      toast.success('Image uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.error('Display name is required');
      return;
    }

    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }

    setLoading(true);

    try {
      // Update profile
      const profileResponse = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: displayName.trim(),
          email: email.trim(),
          profilePictureUrl,
        }),
      });

      if (!profileResponse.ok) {
        throw new Error('Failed to update profile');
      }

      // Update chat rules
      const chatRulesResponse = await fetch('/api/chat/rules/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          minSpendCents,
          accessDays,
        }),
      });

      if (!chatRulesResponse.ok) {
        throw new Error('Failed to update chat rules');
      }

      toast.success('Profile updated successfully!');
      
      // Refresh the page to show updated data
      router.refresh();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    setDisplayName(creator.display_name || '');
    setEmail(creator.email || '');
    setProfilePictureUrl(creator.profile_picture_url || '');
    setMinSpendCents(chatRules?.min_spend_cents || 2000);
    setAccessDays(chatRules?.access_days || 30);
  };

  const handleCopyPermalink = async () => {
    try {
      await navigator.clipboard.writeText(permalink);
      setCopied(true);
      toast.success('Permalink copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy permalink');
    }
  };

  // If not the creator's own profile, show the fan view
  if (currentProfile?.id !== creator.id) {
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
                  <span>{displayAccessDays} days access</span>
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
                  {displayMinSpendAmount}
                </div>
                <p className="text-xs text-gray-500">Minimum spend</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <div className="text-lg font-bold text-blue-600 mb-1">{displayAccessDays} days</div>
                <p className="text-xs text-gray-500">Chat access</p>
              </div>
            </div>
            
            <ul className="text-sm text-gray-600 space-y-1 mb-4">
              <li>• Direct messaging with {creator.display_name}</li>
              <li>• Receive exclusive photos and videos</li>
              <li>• {displayAccessDays} days of unlimited chat access</li>
              <li>• Real-time notifications</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {user && currentProfile ? (
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
                      Get Chat Access (${displayMinSpendAmount})
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

  // Creator's own profile - show settings form
  return (
    <div className="bg-slate-50 text-slate-900 font-sans min-h-screen">
      <main className="max-w-3xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-xl font-semibold">Profile Settings</h1>
          <p className="text-sm text-slate-500">Manage your identity and chat access. All fields are pre‑filled with your current values.</p>
        </header>

        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          {/* Identity Section */}
          <section className="rounded-2xl bg-white border border-slate-200 shadow">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold">Identity</h2>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Nickname</label>
                <input 
                  type="text" 
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your nickname"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Email</label>
                <input 
                  type="email" 
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Profile Picture</label>
                <div className="flex items-center gap-3">
                  <img 
                    className="h-14 w-14 rounded-full object-cover bg-slate-200" 
                    src={getProfilePictureUrl(profilePictureUrl)}
                    alt="avatar"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/api/image/profile-pictures/default-avatar.jpg';
                    }}
                  />
                  <div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="block text-sm"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {uploadingImage ? 'Uploading...' : 'JPG or PNG, up to 5MB.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Access & Pricing Section */}
          <section className="rounded-2xl bg-white border border-slate-200 shadow">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold">Chat Access & Pricing</h2>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Price (USD)</label>
                <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                  <span className="px-2 bg-slate-50 text-slate-500 text-sm grid place-items-center">$</span>
                  <input 
                    type="number" 
                    min="1" 
                    max="1000"
                    step="1" 
                    className="w-full px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                    value={minSpendAmount}
                    onChange={(e) => setMinSpendCents(Math.round(parseFloat(e.target.value || '0') * 100))}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Minimum price may apply.</p>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Access Term</label>
                <input 
                  type="number" 
                  min="1" 
                  max="365"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={accessDays}
                  onChange={(e) => setAccessDays(parseInt(e.target.value || '1'))}
                />
                <p className="text-[11px] text-slate-500 mt-1">Days (1-365)</p>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Profile Permalink</label>
                <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 text-sm bg-slate-50 text-slate-600" 
                    value={permalink}
                    readOnly 
                  />
                  <button 
                    type="button" 
                    onClick={handleCopyPermalink}
                    className="px-3 bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Save Controls */}
          <div className="flex items-center gap-3">
            <button 
              type="submit" 
              disabled={loading}
              className="rounded-xl bg-blue-600 text-white text-sm px-4 py-2 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="w-4 h-4" />
              )}
              {loading ? 'Saving...' : 'Save changes'}
            </button>
            <button 
              type="button" 
              onClick={handleCancel}
              className="rounded-xl border border-slate-300 text-slate-700 text-sm px-4 py-2 bg-white hover:bg-slate-50 transition-colors"
            >
              Discard
            </button>
          </div>
        </form>

        {/* Preview Section */}
        <section className="mt-8 rounded-2xl bg-white border border-slate-200 shadow">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold">Preview</h2>
            <p className="text-xs text-slate-500">How your profile appears to fans</p>
          </div>
          <div className="p-5">
            <div className="flex items-start gap-4 mb-4">
              <img 
                className="h-16 w-16 rounded-full object-cover bg-slate-200" 
                src={getProfilePictureUrl(profilePictureUrl)}
                alt="Preview avatar"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/api/image/profile-pictures/default-avatar.jpg';
                }}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-slate-900">{displayName || 'Your Name'}</h3>
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                </div>
                <p className="text-sm text-slate-600 mb-2">Creator on CreatorHub</p>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" />
                    <span>Available for chat</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{accessDays} days access</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="text-center p-2 bg-white rounded">
                  <div className="flex items-center justify-center gap-1 text-sm font-bold text-green-600">
                    <DollarSign className="w-3 h-3" />
                    {minSpendAmount}
                  </div>
                  <p className="text-[10px] text-slate-500">Minimum spend</p>
                </div>
                <div className="text-center p-2 bg-white rounded">
                  <div className="text-sm font-bold text-blue-600">{accessDays} days</div>
                  <p className="text-[10px] text-slate-500">Chat access</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 text-center">
                Fans spend ${minSpendAmount} to get {accessDays} days of chat access
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}