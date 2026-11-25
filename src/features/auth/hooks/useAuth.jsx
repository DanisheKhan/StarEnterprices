import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabase';
import { signIn as apiSignIn, signOut as apiSignOut, getUserProfile } from '../api/auth.api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [storeAccess, setStoreAccess] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadUserData(sessionUser) {
    if (!sessionUser) {
      setUser(null);
      setProfile(null);
      setStoreAccess([]);
      setLoading(false);
      return;
    }

    setUser(sessionUser);
    try {
      const data = await getUserProfile(sessionUser.id);
      if (data) {
        setProfile(data.profile);
        setStoreAccess(data.storeAccess);
      }
    } catch (err) {
      console.warn('Could not load user profile, using session metadata:', err);
      setProfile({
        id: sessionUser.id,
        full_name: sessionUser.user_metadata?.full_name || 'Mazhar Sheikh',
        role: sessionUser.user_metadata?.role || 'owner',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUserData(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUserData(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const effectiveProfile = user
    ? profile || {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || 'Mazhar Sheikh',
        role: user.user_metadata?.role || 'owner',
        assignedBranch: 'all',
      }
    : null;

  const isOwner = Boolean(
    user &&
      (effectiveProfile?.role === 'owner' || user.user_metadata?.role === 'owner')
  );

  function canAccessStore(_storeIdOrCode) {
    if (!user) return false;
    if (isOwner) return true;
    return storeAccess.some((a) => a.store_id === _storeIdOrCode && a.is_active);
  }

  /**
   * Sign in via Supabase Auth with email and password verification
   */
  async function signIn({ email, password }) {
    const trimmedEmail = email?.trim().toLowerCase();
    const data = await apiSignIn({ email: trimmedEmail, password });
    if (data?.user) {
      await loadUserData(data.user);
    }
    return {
      role: data?.user?.user_metadata?.role || 'owner',
      redirectTo: '/admin',
      session: data,
    };
  }

  const value = {
    user,
    profile: effectiveProfile,
    storeAccess,
    isOwner,
    canAccessStore,
    loading,
    signIn,
    signOut: async () => {
      await apiSignOut();
      setUser(null);
      setProfile(null);
      setStoreAccess([]);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
