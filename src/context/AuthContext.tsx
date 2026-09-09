import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Profile } from "../types";
import { getCurrentProfile } from "../lib/repository";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // The user whose profile is currently held. Background token refreshes re-emit
  // auth events for the same user; refetching then would blank the profile and
  // unmount the routed page, discarding unsaved editor input.
  const loadedUserId = useRef<string | null>(null);

  async function refreshProfile() {
    if (!supabase) {
      setProfile(null);
      loadedUserId.current = null;
      return;
    }
    const next = await getCurrentProfile();
    setProfile(next);
    loadedUserId.current = next?.id ?? null;
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      try {
        if (data.session) await refreshProfile();
      } finally {
        setLoading(false);
      }
    }).catch(() => setLoading(false));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        loadedUserId.current = null;
        setLoading(false);
        return;
      }
      // Token refresh or tab refocus for the already-loaded user: keep the
      // mounted tree and the profile exactly as they are.
      if (nextSession.user.id === loadedUserId.current) return;
      setLoading(true);
      queueMicrotask(() => void refreshProfile().catch(() => undefined).finally(() => setLoading(false)));
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(() => ({
    session,
    profile,
    loading,
    configured: isSupabaseConfigured,
    refreshProfile,
    signOut: async () => { if (supabase) await supabase.auth.signOut(); },
  }), [session, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
