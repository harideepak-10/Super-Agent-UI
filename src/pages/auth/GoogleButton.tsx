import { useEffect, useRef, useState } from "react";

// Same web client as the Flutter app (core/services/google_auth_service.dart).
// The site's origin (e.g. http://localhost:5173) must be an authorised JavaScript origin in Google Cloud.
const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ||
  "874181358790-qgc6h5mid481khegru1ub237du4qkk12.apps.googleusercontent.com";

/** Google Identity Services button → id_token → POST /auth/google/. */
export function GoogleButton({ onToken, label = "continue_with" }: { onToken: (idToken: string) => void; label?: "continue_with" | "signup_with" | "signin_with" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!CLIENT_ID) return;
    const init = () => {
      const g = (window as any).google?.accounts?.id;
      if (!g || !ref.current) return;
      g.initialize({ client_id: CLIENT_ID, callback: (r: any) => onToken(r.credential) });
      g.renderButton(ref.current, { theme: "outline", size: "large", width: Math.min(ref.current.offsetWidth || 360, 400), text: label, shape: "pill", logo_alignment: "center" });
      setReady(true);
    };
    if ((window as any).google?.accounts) return init();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.onload = init;
    document.head.appendChild(s);
  }, [onToken, label]);
  if (!CLIENT_ID) return null;
  return (
    <>
      {/* hidden until Google's script has rendered the button (it may be blocked or offline) */}
      <div ref={ref} className={ready ? "flex h-11 w-full justify-center" : "h-0 w-full overflow-hidden"} />
      {ready && <div className="my-5 flex items-center gap-3 text-xs text-[#9ea3b0]"><div className="h-px flex-1 bg-[#e5e7eb]" />or with email<div className="h-px flex-1 bg-[#e5e7eb]" /></div>}
    </>
  );
}
