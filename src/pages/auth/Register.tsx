import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "@/lib/config";
import { useAuth } from "@/store/auth";
import { errMsg } from "@/lib/utils";
import { Button, Field, Input, PasswordInput } from "@/components/ui";
import { AuthShell } from "./AuthShell";
import { GoogleButton } from "./GoogleButton";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setSession = useAuth((s) => s.setSession);
  const nav = useNavigate();

  const google = useCallback(async (id_token: string) => {
    try {
      const { data } = await axios.post(`${API_URL}/api/v1/auth/google/`, { id_token });
      setSession(data.user, data.tokens.access, data.tokens.refresh);
      nav("/setup/business", { replace: true });
    } catch (err) { setError(errMsg(err)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const { data } = await axios.post(`${API_URL}/api/v1/auth/register/`, form);
      setSession(data.user, data.tokens.access, data.tokens.refresh);
      nav("/setup/business", { replace: true });
    } catch (err) { setError(errMsg(err)); }
    finally { setLoading(false); }
  };

  return (
    <AuthShell title="Create Account" subtitle="Set up your workspace and hire your first agent" footer={<>Already have an account? <Link to="/login" className="font-semibold text-accent hover:underline">Login</Link></>}>
      <GoogleButton onToken={google} label="signup_with" />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name"><Input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" required autoComplete="email" placeholder="example@gmail.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Password" hint="At least 8 characters, not too common."><PasswordInput required autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        {error && <p className="text-sm text-err">{error}</p>}
        <Button variant="primary" className="h-11 w-full" loading={loading}>Sign up</Button>
      </form>
    </AuthShell>
  );
}
