import { useCallback, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "@/lib/config";
import { useServer } from "@/store/server";
import { useAuth } from "@/store/auth";
import { errMsg } from "@/lib/utils";
import { Button, Field, Input, PasswordInput } from "@/components/ui";
import { AuthShell } from "./AuthShell";
import { GoogleButton } from "./GoogleButton";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setSession = useAuth((s) => s.setSession);
  const server = useServer((s) => s.status);
  const nav = useNavigate();
  const from = (useLocation().state as any)?.from ?? "/";

  const finish = (data: any) => { setSession(data.user, data.tokens.access, data.tokens.refresh); nav(from, { replace: true }); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("");
    try { finish((await axios.post(`${API_URL}/api/v1/auth/login/`, { email, password })).data); }
    catch (err) { setError(errMsg(err)); }
    finally { setLoading(false); }
  };

  const google = useCallback(async (id_token: string) => {
    try { finish((await axios.post(`${API_URL}/api/v1/auth/google/`, { id_token })).data); }
    catch (err) { setError(errMsg(err)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthShell title="Welcome Back" subtitle="Sign in to your AI workforce" footer={<>Are you a new member? <Link to="/register" className="font-semibold text-accent hover:underline">Sign up</Link></>}>
      {server === "down" && (
        <div className="mb-5 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2.5 text-xs text-warn">
          Can't reach the backend at <span className="font-mono">{API_URL}</span>. Start Django or set <span className="font-mono">VITE_API_URL</span> in <span className="font-mono">.env</span>.
        </div>
      )}
      <GoogleButton onToken={google} />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email address"><Input type="email" autoFocus required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@gmail.com" /></Field>
        <Field label="Password"><PasswordInput required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></Field>
        <div className="flex justify-end"><Link to="/forgot-password" className="text-xs text-muted hover:text-fg">Forgot password?</Link></div>
        {error && <p className="text-sm text-err">{error}</p>}
        <Button variant="primary" className="h-11 w-full" loading={loading}>Login</Button>
      </form>
    </AuthShell>
  );
}
