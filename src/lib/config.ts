// Backend used by the Flutter app too. Override with VITE_API_URL in .env (e.g. http://localhost:8000 for local Django).
export const API_URL = ((import.meta.env.VITE_API_URL as string) || "https://super-agent-platform.onrender.com").replace(/\/+$/, "");
export const WS_URL = ((import.meta.env.VITE_WS_URL as string) || API_URL.replace(/^http/, "ws")).replace(/\/+$/, "");
