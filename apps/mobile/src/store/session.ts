import { create } from "zustand";
import { secure, KEYS } from "../lib/secure";
import { hasPin, clearPin } from "../lib/pin";
import { queryClient } from "../lib/query";
import { hideLockScreenCard } from "../lib/notifications";

const DEFAULT_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

interface SessionState {
  status: "loading" | "signedOut" | "signedIn";
  accessToken: string | null;
  refreshToken: string | null;
  email: string | null;
  apiBaseUrl: string;
  /** A local PIN is configured (asked on every cold start). */
  pinEnabled: boolean;
  /** PIN/biometric passed for this process lifetime. */
  unlocked: boolean;
  hydrate: () => Promise<void>;
  signIn: (t: { accessToken: string; refreshToken: string; user?: { email: string } }) => Promise<void>;
  setTokens: (t: { accessToken: string; refreshToken: string }) => Promise<void>;
  signOut: () => Promise<void>;
  setApiBaseUrl: (url: string) => Promise<void>;
  setPinEnabled: (on: boolean) => void;
  setUnlocked: (on: boolean) => void;
}

export const useSession = create<SessionState>((set) => ({
  status: "loading",
  accessToken: null,
  refreshToken: null,
  email: null,
  apiBaseUrl: DEFAULT_BASE,
  pinEnabled: false,
  unlocked: false,

  hydrate: async () => {
    const [accessToken, refreshToken, apiBaseUrl, email, pinEnabled] = await Promise.all([
      secure.get(KEYS.accessToken),
      secure.get(KEYS.refreshToken),
      secure.get(KEYS.apiBaseUrl),
      secure.get(KEYS.email),
      hasPin(),
    ]);
    set({
      accessToken,
      refreshToken,
      email,
      apiBaseUrl: apiBaseUrl ?? DEFAULT_BASE,
      pinEnabled,
      unlocked: !pinEnabled,
      status: accessToken ? "signedIn" : "signedOut",
    });
  },

  signIn: async (t) => {
    queryClient.clear(); // never show a previous account's cached screens to the next one
    await Promise.all([
      secure.set(KEYS.accessToken, t.accessToken),
      secure.set(KEYS.refreshToken, t.refreshToken),
      t.user?.email ? secure.set(KEYS.email, t.user.email) : Promise.resolve(),
    ]);
    set({ accessToken: t.accessToken, refreshToken: t.refreshToken, email: t.user?.email ?? null, status: "signedIn", unlocked: true });
  },

  setTokens: async (t) => {
    await Promise.all([secure.set(KEYS.accessToken, t.accessToken), secure.set(KEYS.refreshToken, t.refreshToken)]);
    set({ accessToken: t.accessToken, refreshToken: t.refreshToken });
  },

  signOut: async () => {
    // A PIN protects a signed-in session; drop it with the session so the next user is not locked out.
    await Promise.all([
      secure.del(KEYS.accessToken), secure.del(KEYS.refreshToken), secure.del(KEYS.email), clearPin(),
      hideLockScreenCard().catch(() => undefined), // the pinned card belongs to this account
    ]);
    queryClient.clear();
    set({ accessToken: null, refreshToken: null, email: null, status: "signedOut", pinEnabled: false, unlocked: true });
  },

  setApiBaseUrl: async (url) => {
    await secure.set(KEYS.apiBaseUrl, url);
    set({ apiBaseUrl: url });
  },

  setPinEnabled: (on) => set({ pinEnabled: on, unlocked: true }),
  setUnlocked: (on) => set({ unlocked: on }),
}));
