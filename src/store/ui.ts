import { create } from "zustand";
import { persist } from "zustand/middleware";

type UI = {
  theme: "dark" | "light";
  sidebarOpen: boolean;
  searchOpen: boolean;
  toggleTheme: () => void;
  setSidebar: (v: boolean) => void;
  setSearch: (v: boolean) => void;
};

export const useUI = create<UI>()(
  persist(
    (set) => ({
      theme: "light",
      sidebarOpen: false,
      searchOpen: false,
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setSidebar: (sidebarOpen) => set({ sidebarOpen }),
      setSearch: (searchOpen) => set({ searchOpen }),
    }),
    { name: "superagent-ui", partialize: (s) => ({ theme: s.theme }) }
  )
);
