import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "@/lib/config";
import { useAuth } from "@/store/auth";
import { errMsg } from "@/lib/utils";
import { Button, Field, Input, PasswordInput } from "@/components/ui";
import { AuthShell } from "./AuthShell";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setSession = useAuth((s) => s.setSession);
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const { data } = await axios.post(`${API_URL}/api/v1/auth/register/`, form);
      setSession(data.user, data.tokens.access, data.tokens.refresh);
      nav("/agents/library", { replace: true });
    } catch (err) { setError(errMsg(err)); }
    finally { setLoading(false); }
  };

  return (
    <AuthShell title="Create your account" subtitle="Set up a workspace and activate your first agent" footer={<>Already have an account? <Link to="/login" className="text-accent hover:underline">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name"><Input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Password" hint="At least 8 characters, not too common."><PasswordInput required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        {error && <p className="text-sm text-err">{error}</p>}
        <Button variant="primary" className="w-full" loading={loading}>Create account</Button>
      </form>
    </AuthShell>
  );
}
