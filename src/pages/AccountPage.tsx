import { useState, type FormEvent } from "react";
import { Notice } from "../components/Notice";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export function validateNewPassword(password: string, confirmation: string): string {
  if (password.length < 12) return "Use at least 12 characters for your password.";
  if (password !== confirmation) return "The passwords do not match.";
  return "";
}

export function AccountPage() {
  const { profile } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateNewPassword(password, confirmation);
    setError(validation);
    setMessage("");
    if (validation || !supabase) return;

    setWorking(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setWorking(false);
    if (updateError) {
      setError("Your password could not be updated. Sign in with a fresh email link and try again.");
      return;
    }
    setPassword("");
    setConfirmation("");
    setMessage("Password saved. You can use it the next time you sign in.");
  }

  return (
    <>
      <section className="page-heading">
        <div><p className="eyebrow">Account</p><h1>Sign-in settings</h1><p className="muted">Manage password access for {profile?.email}.</p></div>
      </section>
      <section className="panel account-panel">
        <div><h2>Set or change password</h2><p className="muted">Use a unique password stored in your password manager.</p></div>
        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <form className="form-grid" onSubmit={submit}>
          <label>New password<input type="password" required minLength={12} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label>Confirm new password<input type="password" required minLength={12} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          <button className="button primary" disabled={working}>{working ? "Saving…" : "Save password"}</button>
        </form>
      </section>
    </>
  );
}
