import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { API_URL } from "@/lib/config";
import { errMsg } from "@/lib/utils";
import { Button, Field, Input, PasswordInput } from "@/components/ui";
import { AuthShell } from "./AuthShell";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("");
    try { await axios.post(`${API_URL}/api/v1/auth/forgot-password/`, { email }); setSent(true); }
    catch (err) { setError(errMsg(err)); }
    finally { setLoading(false); }
  };
  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a reset link" footer={<Link to="/login" className="text-accent hover:underline">Back to sign in</Link>}>
      {sent ? <p className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2.5 text-sm text-ok">If that email exists, a reset link has been sent.</p> : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email"><Input type="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {error && <p className="text-sm text-err">{error}</p>}
          <Button variant="primary" className="w-full" loading={loading}>Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nav = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("");
    try { await axios.post(`${API_URL}/api/v1/auth/reset-password/`, { token, password }); nav("/login"); }
    catch (err) { setError(errMsg(err)); }
    finally { setLoading(false); }
  };
  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={submit} className="space-y-4">
        {!params.get("token") && <Field label="Reset token"><Input required value={token} onChange={(e) => setToken(e.target.value)} /></Field>}
        <Field label="New password"><PasswordInput autoFocus required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {error && <p className="text-sm text-err">{error}</p>}
        <Button variant="primary" className="w-full" loading={loading}>Update password</Button>
      </form>
    </AuthShell>
  );
}
