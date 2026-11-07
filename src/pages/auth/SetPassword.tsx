import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { post } from "@/api/client";
import { errMsg } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { Button, Field, PasswordInput } from "@/components/ui";
import { toast } from "@/components/toast";
import { AuthShell } from "./AuthShell";

/** First login with a temporary password (an Admin / Manager created the account): the person
 *  must choose their own password before using the app. */
export function SetPassword() {
  const qc = useQueryClient();
  const { user, refresh, setUser, clear } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [loading, setLoading] = useState(false);
  const mismatch = again.length > 0 && next !== again;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== again) return;
    setLoading(true);
    try {
      await post("/profile/change-password/", { current_password: current, new_password: next });
      if (user) setUser({ ...user, must_change_password: false });
      toast.ok("Password set — welcome!");
    } catch (err) {
      toast.err(errMsg(err));
    } finally {
      setLoading(false);
    }
  };
  const signOut = async () => {
    try { await post("/auth/logout/", { refresh }); } catch { /* ignore */ }
    clear(); qc.clear();
  };

  return (
    <AuthShell title="Set your own password" subtitle={`Welcome${user?.name ? `, ${user.name}` : ""}! You signed in with a temporary password — choose your own to continue.`}
      footer={<button type="button" onClick={signOut} className="text-accent hover:underline cursor-pointer">Sign out</button>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Temporary password"><PasswordInput autoFocus required value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
        <Field label="New password" hint="At least 8 characters, not too common, not all numbers.">
          <PasswordInput required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Confirm new password" hint={mismatch ? "The passwords don't match." : undefined}>
          <PasswordInput required minLength={8} value={again} onChange={(e) => setAgain(e.target.value)} />
        </Field>
        <Button variant="primary" className="w-full" loading={loading} disabled={!current || !next || mismatch}>Set password</Button>
      </form>
    </AuthShell>
  );
}
