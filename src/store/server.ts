import { create } from "zustand";

/** Result of the startup health check against the Django backend. */
export const useServer = create<{ status: "checking" | "up" | "down"; set: (s: "up" | "down") => void }>((set) => ({
  status: "checking",
  set: (status) => set({ status }),
}));
