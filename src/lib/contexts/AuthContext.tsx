'use client'

import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types/database'

const DEBUG = process.env.NEXT_PUBLIC_DEBUG === '1';

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  resolved: boolean
  supabase: ReturnType<typeof createClient>
  isCreator: boolean
  isFan: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
  initialSession?: Session | null
}

export function AuthProvider({ children, initialSession = null }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null)
  const [session, setSession] = useState<Session | null>(initialSession)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [resolved, setResolved] = useState(false)
  
  // Memoize the Supabase client to prevent multiple instances
  const supabase = useMemo(() => createClient(), [])

  const fetchProfile = useCallback(async (userId: string) => {
    DEBUG && console.log('🔍 Fetching profile for user:', userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_user_id', userId)
        .single()

      if (error) {
        DEBUG && console.log('❌ Profile fetch error:', error);
        // Don't log "not found" errors as they're expected during signup
        if (error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error)
        }
        return null
      }

      DEBUG && console.log('✅ Profile fetched successfully:', data);
      return data
    } catch (error) {
      console.error('Error fetching profile:', error)
      return null
    }
  }, [supabase])

  const refreshProfile = async () => {
    if (!user) return
    const profileData = await fetchProfile(user.id)
    setProfile(profileData)
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      // Let RSC read the cleared cookies on next navigation/refresh
      window.location.href = '/login';
    } catch (error) {
      console.error('Error in signOut:', error);
      throw error;
    }
  }

  useEffect(() => {
    DEBUG && console.log('🔐 AuthContext initializing...', { hasInitialSession: !!initialSession });

    let isActive = true;

    const timeout = (ms: number) =>
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('AUTH_INIT_TIMEOUT')), ms));

    (async () => {
      try {
        // If we have an initial session, use it and fetch profile
        if (initialSession?.user) {
          DEBUG && console.log('📋 Using initial session:', { userId: initialSession.user.id });
          const profileData = await fetchProfile(initialSession.user.id);
          if (!isActive) return;
          DEBUG && console.log('👤 Initial profile set from server session:', profileData);
          setProfile(profileData);
          setResolved(true);
          setLoading(false);
          return;
        }

        // Otherwise, race getSession with a 10s watchdog so UI never blocks forever
        const { data: { session } } = await Promise.race([
          supabase.auth.getSession(),
          timeout(10000),
        ]);

        if (!isActive) return;

        DEBUG && console.log('📋 Initial session from client:', { hasSession: !!session, userId: session?.user?.id });
        setSession(session ?? null);
        setUser(session?.user ?? null);

        if (session?.user) {
          const profileData = await fetchProfile(session.user.id);
          if (!isActive) return;
          DEBUG && console.log('👤 Initial profile set:', profileData);
          setProfile(profileData);
        }
      } catch (e) {
        // If we timed out or errored, don't immediately clear auth state
        // The onAuthStateChange listener will handle the actual auth state
        console.warn('Auth init fallback (continuing without session):', (e as Error).message);
        DEBUG && console.log('⏳ Waiting for onAuthStateChange to handle auth state...');
      } finally {
        if (isActive) {
          setLoading(false);
          setResolved(true);
        }
        DEBUG && console.log('✅ Auth loading complete');
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isActive) return;
      DEBUG && console.log('🔄 Auth state changed:', { hasSession: !!session, userId: session?.user?.id });
      setSession(session ?? null);
      setUser(session?.user ?? null);

      if (session?.user) {
        const profileData = await fetchProfile(session.user.id);
        if (!isActive) return;
        DEBUG && console.log('👤 Profile updated:', profileData);
        setProfile(profileData);
      } else {
        setProfile(null);
      }
      setLoading(false);
      setResolved(true);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [supabase.auth, fetchProfile, initialSession])

  const value = {
    user,
    session,
    profile,
    loading,
    resolved,
    supabase,
    isCreator: profile?.user_type === 'CREATOR',
    isFan: profile?.user_type === 'FAN',
    signOut,
    refreshProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
