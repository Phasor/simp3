'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Edit, Save, X, Camera, User, Mail, Copy, Check, Star } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import type { Profile } from '@/lib/types/database';
import { getProfilePictureUrl, getBannerImageUrl } from '@/lib/utils/bunnynet';
import { BannerUpload } from '@/components/ui/BannerUpload';
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
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [copiedLanding, setCopiedLanding] = useState(false);
  
  // Form state for editing
  const [displayName, setDisplayName] = useState(creator.display_name || '');
  const [email, setEmail] = useState(creator.email || '');
  const [profilePictureUrl, setProfilePictureUrl] = useState(creator.profile_picture_url || '');
  const [bannerImageUrl, setBannerImageUrl] = useState(creator.banner_image_url || '');
  const [aboutText, setAboutText] = useState(creator.about_text || '');
  const [minSpendCents, setMinSpendCents] = useState(chatRules?.min_spend_cents || 2000);
  const [accessDays, setAccessDays] = useState(chatRules?.access_days || 30);

  const minSpendAmount = minSpendCents / 100;
  
  // Generate landing page URL
  const landingPageUrl = `https://simp3.app/creator/${creator.id}/landing`;


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

  const handleBannerUpload = async (file: File | null) => {
    if (!file) return;

    setUploadingBanner(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/banner-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setBannerImageUrl(data.url);
      toast.success('Banner image uploaded successfully!');
    } catch (error) {
      console.error('Banner upload error:', error);
      toast.error('Failed to upload banner image');
    } finally {
      setUploadingBanner(false);
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
          bannerImageUrl,
          aboutText: aboutText.trim(),
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
    setBannerImageUrl(creator.banner_image_url || '');
    setAboutText(creator.about_text || '');
    setMinSpendCents(chatRules?.min_spend_cents || 2000);
    setAccessDays(chatRules?.access_days || 30);
  };

  const handleCopyLandingPage = async () => {
    try {
      await navigator.clipboard.writeText(landingPageUrl);
      setCopiedLanding(true);
      toast.success('Landing page URL copied to clipboard!');
      setTimeout(() => setCopiedLanding(false), 2000);
    } catch (error) {
      toast.error('Failed to copy landing page URL');
    }
  };

  // Creator profile settings - always show settings form
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
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-500 mb-3">Banner Image</label>
                <BannerUpload
                  onFileSelect={handleBannerUpload}
                  currentImageUrl={bannerImageUrl}
                  uploading={uploadingBanner}
                  maxSize={10 * 1024 * 1024} // 10MB
                />
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                  💡 <strong>Twitter Tip:</strong> Use 1200×630px for best Twitter card display. Your banner will appear when fans share your landing page!
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-500 mb-2">About You</label>
                <textarea
                  value={aboutText}
                  onChange={(e) => setAboutText(e.target.value)}
                  placeholder="Tell fans what you love to talk about… 💕 Share your interests, hobbies, or what makes you unique!"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  maxLength={400}
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-slate-500">
                    This appears on your public landing page. Emoji and simple formatting supported.
                  </p>
                  <span className={`text-xs ${aboutText.length > 350 ? 'text-red-500' : 'text-slate-400'}`}>
                    {aboutText.length}/400
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Access & Pricing Section */}
          <section className="rounded-2xl bg-white border border-slate-200 shadow">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold">Chat Access & Pricing</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </div>
              
              <div>
                <label className="block text-xs text-slate-500 mb-1">Landing Page URL (for social media)</label>
                <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 text-sm bg-slate-50 text-slate-600" 
                    value={landingPageUrl}
                    readOnly 
                  />
                  <button 
                    type="button" 
                    onClick={handleCopyLandingPage}
                    className="px-3 bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition-colors flex items-center gap-1"
                  >
                    {copiedLanding ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedLanding ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Share this conversion-optimized page on your social media. Includes Twitter Card optimization.</p>
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

        {/* Landing Page Preview Section */}
        <section className="mt-8 rounded-2xl bg-white border border-slate-200 shadow">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold">Landing Page Preview</h2>
            <p className="text-xs text-slate-500">How your landing page appears to fans on social media</p>
          </div>
          <div className="p-5">
            {/* Mini landing page preview */}
            <div className="bg-gradient-to-b from-white to-slate-50 rounded-xl border border-slate-200 p-6 text-center">
              {/* Hero profile section */}
              <div className="flex flex-col items-center mb-4">
                <div className="relative">
                  <img 
                    src={getProfilePictureUrl(profilePictureUrl)} 
                    className="h-20 w-20 rounded-full object-cover shadow-lg border-2 border-white" 
                    alt="Creator avatar"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/api/image/profile-pictures/default-avatar.jpg';
                    }}
                  />
                  <div className="absolute bottom-1 right-1 bg-emerald-500 h-3 w-3 rounded-full border-2 border-white" title="Online"></div>
                </div>
                <h1 className="mt-2 text-lg font-bold">
                  {displayName || 'Your Name'} <Star className="inline w-4 h-4 text-amber-500 fill-current" />
                </h1>
                <p className="text-xs text-slate-500">Creator on simp3 · Available now</p>
                
                {/* CTA Button preview */}
                <button className="mt-3 flex items-center justify-center gap-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full text-xs font-medium shadow-sm">
                  💬 Chat with me
                </button>
              </div>

              {/* Banner preview */}
              <div className="mb-4 rounded-xl overflow-hidden shadow-lg border border-slate-200">
                <div className="w-full aspect-[1.91/1]">
                  <img 
                    src={getBannerImageUrl(bannerImageUrl)}
                    className="w-full h-full object-cover" 
                    alt="Banner preview"
                  />
                </div>
              </div>

              {/* About section */}
              {aboutText && (
                <div className="mb-4 px-2">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2 text-center">About</h3>
                  <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap text-justify">
                    {aboutText}
                  </p>
                </div>
              )}

              {/* Offer section */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                <h2 className="text-sm font-semibold mb-2">Unlock Private Chat Access</h2>
                <p className="text-slate-600 text-xs mb-3">
                  Get exclusive one-on-one access to chat, photos, and updates directly from{' '}
                  <strong>{displayName || 'this creator'}</strong>.
                </p>

                <div className="flex justify-center gap-3 mb-3">
                  <div className="rounded-lg border border-slate-200 px-3 py-2 bg-gradient-to-br from-slate-50 to-white">
                    <p className="text-[10px] text-slate-500">Price</p>
                    <p className="text-lg font-bold">${minSpendAmount}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 px-3 py-2 bg-gradient-to-br from-slate-50 to-white">
                    <p className="text-[10px] text-slate-500">Access</p>
                    <p className="text-lg font-bold">{accessDays} days</p>
                  </div>
                </div>

                <button className="w-full bg-indigo-600 text-white font-semibold text-sm px-6 py-2 rounded-full shadow hover:bg-indigo-500 transition-colors">
                  💬 Chat with me
                </button>

                <p className="mt-2 text-[10px] text-slate-500">Secure and private · Cancel anytime</p>
              </div>

              {/* Social proof */}
              <div className="mt-4 text-center">
                <p className="text-slate-600 text-xs">
                  ⭐ Over <strong>1,200</strong> fans have already chatted with{' '}
                  <strong>{displayName || 'this creator'}</strong>
                </p>
              </div>
            </div>
            
            <div className="mt-3 text-center">
              <p className="text-xs text-slate-500">
                This is how your landing page will appear when shared on social media
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}