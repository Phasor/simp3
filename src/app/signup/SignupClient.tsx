'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/contexts/AuthContext'
import { FileUpload } from '@/components/ui/FileUpload'

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user: authUser, loading: authLoading, supabase, refreshProfile } = useAuth()
  const [userType, setUserType] = useState<'CREATOR' | 'FAN' | null>(null)
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'select-type' | 'enter-email' | 'complete-profile'>('select-type')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Onboarding fields
  const [displayName, setDisplayName] = useState('')
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null)
  const [chatPriceCents, setChatPriceCents] = useState(2000) // $20 default
  const [chatAccessDays, setChatAccessDays] = useState(30) // 30 days default

  const requestedStep = searchParams.get('step'); // 'complete' | null
  const utParam = searchParams.get('ut') as 'CREATOR' | 'FAN' | null;

  // Pick up ut param early (also stash for later navigations)
  useEffect(() => {
    if (utParam) {
      console.log('📋 Setting user type from URL param:', utParam);
      setUserType(utParam);
      try { 
        localStorage.setItem('signup_user_type', utParam); 
      } catch (e) {
        console.warn('Failed to set localStorage:', e);
      }
    } else {
      const ls = (typeof window !== 'undefined')
        ? (localStorage.getItem('signup_user_type') as 'CREATOR' | 'FAN' | null)
        : null;
      if (ls) {
        console.log('📋 Setting user type from localStorage:', ls);
        setUserType(ls);
      }
    }
  }, [utParam]);

  // Decide the step after auth state is known
  useEffect(() => {
    console.log('🔄 Step decision useEffect running:', { 
      authLoading, 
      authUser: !!authUser, 
      requestedStep, 
      utParam,
      currentUrl: window.location.href,
      searchParams: Object.fromEntries(searchParams.entries())
    });
    
    if (authLoading) return;

    // If the server sent us here with step=complete, check if it's a fan first
    if (requestedStep === 'complete') {
      if (utParam === 'FAN') {
        console.log('🔄 Fan reached completion step, redirecting to dashboard');
        router.replace('/');
        return;
      }
      console.log('✅ Server requested complete step for creator, showing profile form immediately');
      setStep('complete-profile');
      return;
    }

    // Only do the async checks if we don't have a specific step requested
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔍 Session check result:', { session: !!session, user: !!session?.user });
      
      if (!session?.user) {
        console.log('👤 No session, showing select-type step');
        setStep('select-type');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();

      console.log('📊 Profile check result:', { profile: !!profile });

      if (profile) {
        console.log('🏠 Profile exists, redirecting to home');
        router.replace('/'); // already set up
        return;
      }

      console.log('✅ No profile, showing complete-profile step');
      setStep('complete-profile');
    })();
  }, [authLoading, requestedStep, supabase, router])

  const handleUserTypeSelect = (type: 'CREATOR' | 'FAN') => {
    setUserType(type)
    setStep('enter-email')
  }

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !userType) return

    setLoading(true)
    setError('')

    try {
      // Store user type in localStorage as backup, but primarily pass through URL
      localStorage.setItem('signup_user_type', userType)
      
      const redirectTo = `${window.location.origin}/auth/callback?next=/signup&ut=${userType}`
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      })

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success('Magic link sent! Check your email.', {
        icon: '✨',
        duration: 5000,
      })
    } catch (err) {
      console.error('Signup error:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const signUpWithGoogle = async () => {
    if (!userType) return

    try {
      // Store user type in localStorage as backup, but primarily pass through URL
      localStorage.setItem('signup_user_type', userType)
      
      const redirectTo = `${window.location.origin}/auth/callback?next=/signup&ut=${userType}`
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })

      if (error) {
        toast.error(error.message)
      }
    } catch (err) {
      console.error('Google signup error:', err)
      toast.error('An unexpected error occurred. Please try again.')
    }
  }

  const uploadProfilePicture = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log('📤 Uploading file:', file.name, 'Size:', file.size, 'bytes');

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch('/api/upload/profile-picture', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        credentials: 'include', // Ensure auth cookie is sent
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      console.log('📤 Upload response:', result);
      return result.url;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('❌ Upload timeout after 30 seconds');
        toast.error('Upload timed out. Please try a smaller image.');
      } else {
        console.error('❌ Error uploading profile picture:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to upload profile picture');
      }
      return null;
    }
  };

  // Timeout utility for database operations
  const withTimeout = <T,>(p: Promise<T>, ms = 15000): Promise<T> => {
    console.log(`⏱️ Setting up timeout for ${ms}ms`);
    return Promise.race([
      p,
      new Promise<T>((_, reject) => 
        setTimeout(() => {
          console.log('⏰ Timeout fired!');
          reject(new Error('Database operation timeout'));
        }, ms)
      )
    ]);
  };

  const completeProfile = async () => {
    if (!authUser) {
      setError('No authenticated user. Please sign in again.');
      router.replace('/login');
      return;
    }
    if (!userType || !displayName.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    // Critical: Wait for auth loading to complete
    if (authLoading) {
      setError('Authentication still loading. Please wait...');
      return;
    }

    setLoading(true);
    setError('');
    console.log('🚀 Starting profile creation...');

    try {
      // Use authUser from context instead of calling getSession() which hangs
      console.log('🔐 Using authenticated user from context...');
      console.log('📝 Creating profile for user:', authUser.id);
      console.log('🔍 User email:', authUser.email);
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(authUser.id)) {
        console.error('❌ Invalid UUID format:', authUser.id);
        setError('Invalid user ID format. Please sign out and sign in again.');
        return;
      }
      
      console.log('✅ UUID format is valid');

      // Try server-side profile creation first (more reliable)
      console.log('🔄 Attempting server-side profile creation...');
      try {
        const response = await fetch('/api/profile/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            userType,
            displayName: displayName.trim(),
          }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ Server-side profile creation successful:', result);
        } else {
          const errorData = await response.json();
          console.log('⚠️ Server-side creation failed, trying client-side:', errorData);
          throw new Error(errorData.error || 'Server-side creation failed');
        }
      } catch (serverError) {
        console.log('⚠️ Server-side creation failed, trying client-side:', serverError);
        
        // Fallback to client-side creation
        const profileData = {
          auth_user_id: authUser.id,
          email: authUser.email!,
          user_type: userType,
          display_name: displayName.trim(),
          profile_picture_url: null,
          onboarding_completed: true,
        };
        
        console.log('📋 Client-side profile data prepared:', profileData);
        
        const { data, error } = await supabase
          .from('profiles')
          .insert(profileData)
          .select();

        console.log('📊 Client-side INSERT result:', { data, error });
        
        if (error) {
          console.error('❌ Client-side INSERT failed:', error);
          throw error;
        }
        console.log('✅ Client-side profile created successfully!');
      }

      // Handle profile picture upload if provided
      if (profilePictureFile) {
        console.log('📸 Uploading profile picture...');
        toast.loading('Uploading profile picture...', { id: 'upload' });
        
        try {
          const profilePictureUrl = await uploadProfilePicture(profilePictureFile);
          toast.dismiss('upload');
          
          if (profilePictureUrl) {
            await supabase
              .from('profiles')
              .update({ profile_picture_url: profilePictureUrl })
              .eq('auth_user_id', authUser.id);
            toast.success('Profile picture uploaded successfully!');
          }
        } catch (uploadError) {
          console.error('Profile picture upload error:', uploadError);
          toast.dismiss('upload');
          toast.error('Failed to upload profile picture. Profile created without it.');
        }
      }

      // Handle chat rules for creators
      if (userType === 'CREATOR') {
        console.log('⚙️ Creating chat rules for creator...');
        try {
          // Get the profile ID first
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('auth_user_id', authUser.id)
            .single();

          if (profile) {
            await supabase
              .from('chat_rules')
              .upsert({
                creator_id: profile.id,
                min_spend_cents: chatPriceCents,
                access_days: chatAccessDays,
                access_window_days: 30,
                time_unit: 'days'
              }, { onConflict: 'creator_id' });
            console.log('✅ Chat rules created successfully');
          }
        } catch (chatRulesErr) {
          console.error('⚠️ Chat rules creation failed (non-fatal):', chatRulesErr);
          // Don't fail signup for this
        }
      }

      // Success! Clean up and redirect
      localStorage.removeItem('signup_user_type');
      
      toast.success(`Welcome to CreatorHub! Your ${userType.toLowerCase()} account has been created.`, {
        icon: '🎉',
        duration: 5000,
      });
      
      console.log('🎉 Profile creation complete, redirecting...');
      
      // Refresh the auth context to pick up the new profile
      await refreshProfile();
      
      if (userType === 'CREATOR') {
        router.replace('/chat?welcome=true');
      } else {
        router.replace('/');
      }

    } catch (e: unknown) {
      console.error('💥 Profile creation failed:', e);
      setError((e as Error)?.message ?? 'Profile creation failed');
    } finally {
      setLoading(false);
    }
  }


  // Render different steps based on current step
  if (step === 'enter-email') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Join as {userType === 'CREATOR' ? 'a Creator' : 'a Fan'}
            </h1>
            <p className="text-gray-600">Enter your email to get started</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={sendMagicLink} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className={`w-full py-3 rounded-lg font-medium text-white transition-colors ${
                !loading && email
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {loading ? 'Sending Magic Link...' : 'Send Magic Link'}
            </button>
          </form>

          <div className="flex items-center gap-2 my-6">
            <div className="h-px bg-gray-300 flex-1" />
            <span className="text-xs text-gray-500">or</span>
            <div className="h-px bg-gray-300 flex-1" />
          </div>

          <button
            onClick={signUpWithGoogle}
            disabled={loading}
            className="w-full py-3 rounded-lg border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="mt-6 text-center">
            <button
              onClick={() => setStep('select-type')}
              className="text-blue-600 hover:underline text-sm"
            >
              ← Back to account type selection
            </button>
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-600 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'complete-profile') {
    return (
      <div className="min-h-screen bg-gray-50 py-6 px-6">
        <div className="w-full max-w-lg mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Profile</h1>
            <p className="text-gray-600">
              {userType ? `You're signing up as ${userType === 'CREATOR' ? 'a Creator' : 'a Fan'}` : 'Choose your account type'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {!userType && (
            <div className="space-y-4 mb-6">
              <button
                onClick={() => setUserType('CREATOR')}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
              >
                <div className="flex items-center">
                  <span className="text-2xl mr-3">⭐</span>
                  <div>
                    <div className="font-semibold">I&apos;m a Creator</div>
                    <div className="text-sm text-gray-600">Monetize content and engage with fans</div>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => setUserType('FAN')}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
              >
                <div className="flex items-center">
                  <span className="text-2xl mr-3">💖</span>
                  <div>
                    <div className="font-semibold">I&apos;m a Fan</div>
                    <div className="text-sm text-gray-600">Support creators and unlock exclusive content</div>
                  </div>
                </div>
              </button>
            </div>
          )}

          {userType && (
            <form onSubmit={(e) => { 
              console.log('📝 Form submitted!', { userType, displayName: displayName.trim(), loading });
              e.preventDefault(); 
              completeProfile(); 
            }} className="space-y-6">
              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Name *
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Profile Picture Upload (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile Picture (optional)
                </label>
                <FileUpload
                  onFileSelect={setProfilePictureFile}
                  maxSize={5 * 1024 * 1024} // 5MB
                  accept={{
                    'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
                  }}
                />
              </div>

              {/* Creator-specific fields */}
              {userType === 'CREATOR' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Chat Access Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        min="5"
                        max="500"
                        step="1"
                        value={chatPriceCents / 100}
                        onChange={(e) => setChatPriceCents(Math.round(parseFloat(e.target.value || '0') * 100))}
                        className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Minimum amount fans need to spend to access chat
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Chat Access Duration (days)
                    </label>
                    <select
                      value={chatAccessDays}
                      onChange={(e) => setChatAccessDays(parseInt(e.target.value))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                      <option value={60}>60 days</option>
                      <option value={90}>90 days</option>
                    </select>
                    <p className="text-sm text-gray-500 mt-1">
                      How long chat access lasts after purchase
                    </p>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={!userType || !displayName.trim() || loading}
                className={`w-full py-3 rounded-lg font-medium text-white transition-colors ${
                  userType && displayName.trim() && !loading
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {loading ? 'Creating Account...' : 'Complete Signup'}
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  // Default: select-type step
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
            <h1 className="typ-h1 text-gray-900 mb-4">Join CreatorHub</h1>
            <p className="typ-body-lg text-gray-600">Pay to message. Unlock photos/videos inside chat.</p>
            <p className="typ-body-sm text-blue-600 mt-2">
              Already have an account? <Link href="/login" className="underline typ-body-sm">Login</Link>
            </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Creator Card */}
          <div 
            className="border-2 rounded-xl p-8 cursor-pointer transition-all border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg"
            onClick={() => handleUserTypeSelect('CREATOR')}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⭐</span>
              </div>
              <h2 className="typ-h2 text-gray-900 mb-2">I&apos;m a Creator</h2>
              <p className="typ-body text-gray-600">Monetize your content and engage with fans</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-green-500 mr-3">💰</span>
                Set your chat pricing
              </div>
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-yellow-500 mr-3">⚡</span>
                Send locked photos & videos
              </div>
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-purple-500 mr-3">🏆</span>
                Track your revenue
              </div>
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-blue-500 mr-3">👥</span>
                Build your fanbase
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm font-medium text-gray-900">Perfect for content creators</p>
            </div>
          </div>

          {/* Fan Card */}
          <div 
            className="border-2 rounded-xl p-8 cursor-pointer transition-all border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg"
            onClick={() => handleUserTypeSelect('FAN')}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💖</span>
              </div>
              <h2 className="typ-h2 text-gray-900 mb-2">I&apos;m a Fan</h2>
              <p className="typ-body text-gray-600">Support creators and unlock exclusive content</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-red-500 mr-3">❤️</span>
                Support your favorite creators
              </div>
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-yellow-500 mr-3">⚡</span>
                Unlock exclusive photos & videos
              </div>
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-blue-500 mr-3">👥</span>
                Chat directly with creators
              </div>
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-purple-500 mr-3">🏆</span>
                Get exclusive access
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm font-medium text-gray-900">Perfect for fans & supporters</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
