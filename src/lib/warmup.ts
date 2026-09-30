import axios from "axios";
import { API_URL } from "./config";
import { useServer } from "@/store/server";

/**
 * Render's free plan puts the backend to sleep after ~15 min idle; the first
 * request then waits 30–60 s while it boots. We fire a health ping the moment
 * the bundle loads (before React renders) so the server is waking up while the
 * intro plays — and nothing in the UI blocks on it.
 */
let started = false;
export function warmUpBackend() {
  if (started) return;
  started = true;
  const t0 = performance.now();
  const ping = (attempt: number): Promise<void> =>
    axios.get(`${API_URL}/api/v1/auth/health/`, { timeout: 90_000 })
      .then(() => useServer.getState().set("up"))
      .catch((e): Promise<void> | void => {
        if (e?.response) return useServer.getState().set("up");          // any HTTP answer = awake
        if (attempt < 2 && performance.now() - t0 < 80_000) return ping(attempt + 1);
        useServer.getState().set("down");
      });
  ping(0);
}
