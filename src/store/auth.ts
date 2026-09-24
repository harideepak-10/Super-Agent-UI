import { create } from "zustand";
import { persist } from "zustand/middleware";

export type User = { id: string; email: string; name?: string; avatar_url?: string | null };

type AuthState = {
  user: User | null;
  access: string | null;
  refresh: string | null;
  setSession: (u: User, access: string, refresh: string) => void;
  setAccess: (a: string, r?: string) => void;
  setUser: (u: User) => void;
  clear: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      access: null,
      refresh: null,
      setSession: (user, access, refresh) => set({ user, access, refresh }),
      setAccess: (access, refresh) => set((s) => ({ access, refresh: refresh ?? s.refresh })),
      setUser: (user) => set({ user }),
      clear: () => set({ user: null, access: null, refresh: null }),
    }),
    { name: "superagent-auth" }
  )
);
