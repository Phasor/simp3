'use client'

import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types/database'
import { useWarmChatInbox } from '@/lib/hooks/useWarmChatInbox'

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
  // 👇 derive from initialSession right away
  const [session, setSession] = useState<Session | null>(initialSession)
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null)
  const [profile, setProfile] = useState<Profile | null>(null)
  
  // If we already have a session from the server, we are NOT loading
  const [loading, setLoading] = useState<boolean>(!initialSession)
  const [resolved, setResolved] = useState<boolean>(!!initialSession)
  
  // Memoize the Supabase client to prevent multiple instances
  const supabase = useMemo(() => createClient(), [])

  // Instance tracking for debugging
  const instanceId = useMemo(() => Math.random().toString(36).slice(2), []);
  
  // Warm chat inbox cache after user is authenticated
  useWarmChatInbox(user?.id);
  
  useEffect(() => {
    console.log('[AuthProvider] mounted instance', instanceId, { hasInitial: !!initialSession, loading, resolved });
  }, [instanceId, initialSession, loading, resolved]);

  // Watchdog: log state changes
  useEffect(() => {
    console.log('[AuthProvider] state change', { 
      hasUser: !!user, 
      profileId: profile?.id, 
      loading, 
      resolved,
      instanceId 
    });
  }, [user, profile?.id, loading, resolved, instanceId]);

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
      return data as Profile
    } catch (error) {
      console.error('Error fetching profile:', error)
      return null
    }
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const profileData = await fetchProfile(user.id)
    setProfile(profileData)
  }, [user, fetchProfile])

  const signOut = useCallback(async () => {
    // Clear client state immediately for instant UI feedback
    setSession(null);
    setUser(null);
    setProfile(null);
    setResolved(true);
    setLoading(false);
    // Navigate to server-side signout — it clears cookies properly then redirects to /login
    window.location.href = '/auth/signout';
  }, [])

  useEffect(() => {
    DEBUG && console.log('🔐 AuthProvider initializing...', { hasInitialSession: !!initialSession, loading, resolved });

    let active = true;
    let watchdogTimer: NodeJS.Timeout | null = null;

    // Watchdog: force resolution after 2 seconds if still stuck
    watchdogTimer = setTimeout(() => {
      if (active && !resolved) {
        console.warn('[AuthProvider] ⚠️ Watchdog forcing resolved after 2s timeout');
        setResolved(true);
        setLoading(false);
      }
    }, 2000);

    (async () => {
      // Case A: server already hydrated us with a session
      if (initialSession?.user) {
        DEBUG && console.log('📋 Using initial session:', { userId: initialSession.user.id });
        const p = await fetchProfile(initialSession.user.id);
        if (!active) return;
        setProfile(p);
        DEBUG && console.log('👤 Initial profile set from server session:', p);
        // we were already resolved = true and loading = false
        if (watchdogTimer) clearTimeout(watchdogTimer);
        return;
      }

      // Case B: no session yet → resolve it on the client once
      try {
        DEBUG && console.log('📋 Getting session from client...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!active) return;

        DEBUG && console.log('📋 Initial session from client:', { hasSession: !!session, userId: session?.user?.id });
        setSession(session ?? null);
        setUser(session?.user ?? null);

        if (session?.user) {
          const p = await fetchProfile(session.user.id);
          if (!active) return;
          DEBUG && console.log('👤 Initial profile set:', p);
          setProfile(p);
        }
      } catch (e) {
        console.warn('Auth init error:', (e as Error).message);
      } finally {
        if (active) {
          setResolved(true);
          setLoading(false);
          if (watchdogTimer) clearTimeout(watchdogTimer);
          DEBUG && console.log('✅ Auth loading complete');
        }
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;
      DEBUG && console.log('🔄 Auth state changed:', { hasSession: !!session, userId: session?.user?.id });
      setSession(session ?? null);
      setUser(session?.user ?? null);

      if (session?.user) {
        const profileData = await fetchProfile(session.user.id);
        if (!active) return;
        DEBUG && console.log('👤 Profile updated:', profileData);
        setProfile(profileData);
      } else {
        setProfile(null);
      }
      setLoading(false);
      setResolved(true);
    });

    return () => {
      active = false;
      if (watchdogTimer) clearTimeout(watchdogTimer);
      subscription.unsubscribe();
    };
  }, [supabase.auth, fetchProfile, initialSession, resolved])

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
