'use client';

/**
 * Auth context. Exposes the current Supabase user/session and the sign-in
 * methods. When Supabase isn't configured, `enabled` is false and the app runs
 * in pure guest mode (localStorage persistence) with no auth UI required.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { supabaseConfigured } from '@/lib/supabase/env';

export type OAuthProvider = 'google' | 'github';

interface AuthContextValue {
  /** True when Supabase is configured — gates all auth features. */
  enabled: boolean;
  /** True until the first session check resolves. */
  loading: boolean;
  user: User | null;
  session: Session | null;
  /** Convenience: signed in and NOT an anonymous/guest user. */
  isAuthenticated: boolean;
  isGuest: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithOtp: (email: string) => Promise<{ error: string | null }>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<{ error: string | null }>;
  continueAsGuest: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const enabled = supabaseConfigured();
  const [loading, setLoading] = useState(enabled);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const supabaseRef = useRef(enabled ? getSupabaseBrowser() : null);

  useEffect(() => {
    const supabase = supabaseRef.current;
    if (!supabase) return;

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const redirectTo = useCallback(() => {
    if (typeof window === 'undefined') return undefined;
    return `${window.location.origin}/auth/callback`;
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const supabase = supabaseRef.current;
    if (!supabase) return { error: 'Auth is not configured.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUpWithPassword = useCallback(
    async (email: string, password: string) => {
      const supabase = supabaseRef.current;
      if (!supabase) return { error: 'Auth is not configured.' };
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo() },
      });
      return { error: error?.message ?? null };
    },
    [redirectTo],
  );

  const signInWithOtp = useCallback(
    async (email: string) => {
      const supabase = supabaseRef.current;
      if (!supabase) return { error: 'Auth is not configured.' };
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo() },
      });
      return { error: error?.message ?? null };
    },
    [redirectTo],
  );

  const signInWithOAuth = useCallback(
    async (provider: OAuthProvider) => {
      const supabase = supabaseRef.current;
      if (!supabase) return { error: 'Auth is not configured.' };
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectTo() },
      });
      return { error: error?.message ?? null };
    },
    [redirectTo],
  );

  const continueAsGuest = useCallback(async () => {
    const supabase = supabaseRef.current;
    if (!supabase) return { error: 'Auth is not configured.' };
    const { error } = await supabase.auth.signInAnonymously();
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = supabaseRef.current;
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const isGuest = Boolean(user?.is_anonymous);
    return {
      enabled,
      loading,
      user,
      session,
      isAuthenticated: Boolean(user) && !isGuest,
      isGuest,
      signInWithPassword,
      signUpWithPassword,
      signInWithOtp,
      signInWithOAuth,
      continueAsGuest,
      signOut,
    };
  }, [
    enabled,
    loading,
    user,
    session,
    signInWithPassword,
    signUpWithPassword,
    signInWithOtp,
    signInWithOAuth,
    continueAsGuest,
    signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>.');
  return ctx;
}
