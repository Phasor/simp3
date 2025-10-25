'use client';
import { useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function ClientProbe() {
  const { user, profile, loading, resolved } = useAuth();

  useEffect(() => {
    console.log('[Probe] mounted');
    return () => console.log('[Probe] unmounted');
  }, []);

  useEffect(() => {
    console.log('[Probe] auth state', { 
      hasUser: !!user,
      userId: user?.id,
      profileId: profile?.id,
      profile: profile,
      loading,
      resolved,
    });
  }, [user, user?.id, profile, profile?.id, loading, resolved]);

  return null;
}

