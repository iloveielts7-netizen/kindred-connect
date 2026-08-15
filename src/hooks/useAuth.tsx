import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { ensureIdentity, forgetIdentity, type IdentityKeys } from "@/lib/crypto";
import { generateStressId } from "@/lib/stress-id";

export type Profile = {
  id: string;
  stress_id: string;
  display_name: string;
  public_key: string | null;
  last_seen_at: string;
  notify_mode: "none" | "generic" | "sender" | "full";
  age_confirmed: boolean;
};

type AuthValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  identity: IdentityKeys | null;
  refreshProfile: () => Promise<void>;
  signOut: (everywhere?: boolean) => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

/** Creates the profile row + device keys the first time an account signs in. */
async function ensureProfile(user: User, identity: IdentityKeys): Promise<Profile> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    if (existing.public_key !== identity.publicKey) {
      const { data: updated } = await supabase
        .from("profiles")
        .update({ public_key: identity.publicKey, last_seen_at: new Date().toISOString() })
        .eq("id", user.id)
        .select("*")
        .single();
      return (updated ?? existing) as Profile;
    }
    return existing as Profile;
  }

  const metadata = user.user_metadata ?? {};
  const displayName =
    (metadata['display_name'] as string | undefined) ||
    (metadata['full_name'] as string | undefined) ||
    (metadata['name'] as string | undefined) ||
    user.email?.split("@")[0] ||
    "Someone";

  // Retry a couple of times in the (unlikely) event of an ID collision.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        stress_id: generateStressId(),
        display_name: displayName.slice(0, 40),
        public_key: identity.publicKey,
        age_confirmed: Boolean(metadata['age_confirmed']),
      })
      .select("*")
      .single();
    if (!error && data) return data as Profile;
    if (error && !error.message.includes("stress_id")) throw error;
  }
  throw new Error("Could not create profile");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [identity, setIdentity] = useState<IdentityKeys | null>(null);

  const bootstrap = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    if (!nextSession?.user) {
      setProfile(null);
      setIdentity(null);
      setLoading(false);
      return;
    }
    try {
      const keys = await ensureIdentity(nextSession.user.id);
      setIdentity(keys);
      setProfile(await ensureProfile(nextSession.user, keys));
    } catch (error) {
      console.error("auth bootstrap failed", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === "TOKEN_REFRESHED") {
        setSession(nextSession);
        return;
      }
      void bootstrap(nextSession);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (active) void bootstrap(data.session);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [bootstrap]);

  // Keep "online" state fresh without storing extra metadata history.
  useEffect(() => {
    if (!session?.user) return;
    const ping = () => {
      void supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", session.user.id);
    };
    ping();
    const interval = window.setInterval(ping, 45_000);
    return () => window.clearInterval(interval);
  }, [session?.user]);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (data) setProfile(data as Profile);
  }, [session?.user]);

  const signOut = useCallback(
    async (everywhere = false) => {
      const userId = session?.user.id;
      await supabase.auth.signOut(everywhere ? { scope: "global" } : undefined);
      if (userId && everywhere) forgetIdentity(userId);
      setProfile(null);
    },
    [session?.user.id],
  );

  const value = useMemo<AuthValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      identity,
      refreshProfile,
      signOut,
    }),
    [loading, session, profile, identity, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
