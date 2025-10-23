'use client'

import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types/database'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  supabase: ReturnType<typeof createClient>
  isCreator: boolean
  isFan: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Memoize the Supabase client to prevent multiple instances
  const supabase = useMemo(() => createClient(), [])

  const fetchProfile = useMemo(() => async (userId: string) => {
    console.log('🔍 Fetching profile for user:', userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_user_id', userId)
        .single()

      if (error) {
        console.log('❌ Profile fetch error:', error);
        // Don't log "not found" errors as they're expected during signup
        if (error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error)
        }
        return null
      }

      console.log('✅ Profile fetched successfully:', data);
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
      // Use the server-side signout route for proper session cleanup
      const response = await fetch('/auth/signout', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to sign out');
      }
      
      // The server route will handle the redirect, but we can also clear local state
      setUser(null);
      setSession(null);
      setProfile(null);
    } catch (error) {
      console.error('Error in signOut:', error);
      throw error;
    }
  }

  useEffect(() => {
    console.log('🔐 AuthContext initializing...');
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('📋 Initial session:', { hasSession: !!session, userId: session?.user?.id });
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        fetchProfile(session.user.id).then((profile) => {
          console.log('👤 Initial profile set:', profile);
          setProfile(profile);
        })
      }
      
      console.log('✅ Auth loading complete');
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', { event, hasSession: !!session, userId: session?.user?.id });
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        const profileData = await fetchProfile(session.user.id)
        console.log('👤 Profile updated:', profileData);
        setProfile(profileData)
      } else {
        console.log('👤 Profile cleared');
        setProfile(null)
      }
      
      console.log('✅ Auth state change complete');
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth, fetchProfile])

  const value = {
    user,
    session,
    profile,
    loading,
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
