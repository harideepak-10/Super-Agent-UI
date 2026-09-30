import { create } from "zustand";

/** Backend reachability, filled by lib/warmup.ts. */
export const useServer = create<{ status: "checking" | "up" | "down"; since: number; set: (s: "checking" | "up" | "down") => void }>((set) => ({
  status: "checking",
  since: Date.now(),
  set: (status) => set({ status }),
}));
