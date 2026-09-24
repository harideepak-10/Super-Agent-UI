import { useEffect, useRef } from "react";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

/** Renders the Google Identity Services button when VITE_GOOGLE_CLIENT_ID is set. */
export function GoogleButton({ onToken }: { onToken: (idToken: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!CLIENT_ID) return;
    const init = () => {
      const g = (window as any).google?.accounts?.id;
      if (!g || !ref.current) return;
      g.initialize({ client_id: CLIENT_ID, callback: (r: any) => onToken(r.credential) });
      g.renderButton(ref.current, { theme: "filled_black", size: "large", width: 360, text: "continue_with", shape: "pill" });
    };
    if ((window as any).google?.accounts) return init();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.onload = init;
    document.head.appendChild(s);
  }, [onToken]);
  if (!CLIENT_ID) return null;
  return (
    <>
      <div ref={ref} className="flex justify-center" />
      <div className="my-5 flex items-center gap-3 text-xs text-muted"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>
    </>
  );
}
