import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { Notice } from "../components/Notice";

export function LoginPage() {
  const { session, profile, configured, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  if (!loading && session && profile?.active) return <Navigate to="/shipments" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setSending(true); setError(""); setMessage("");
    const redirect = `${window.location.origin}${window.location.pathname}#/shipments`;
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: redirect },
    });
    setSending(false);
    if (signInError) setError("That email is not invited, or the sign-in link could not be sent.");
    else setMessage("Check your email for a secure sign-in link.");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">NS</div>
        <p className="eyebrow">Secure staff workspace</p>
        <h1>Shipment updates from anywhere.</h1>
        <p className="muted">Sign in with your invited work email. No password is required.</p>
        {!configured && <Notice tone="error">This deployment is not connected to Supabase. Add the project URL and publishable key before signing in.</Notice>}
        {session && profile && !profile.active && <Notice tone="error">Your account exists but has not been activated by an administrator.</Notice>}
        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <form onSubmit={submit}>
          <label>Email address<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label>
          <button className="button primary full" disabled={!configured || sending}>{sending ? "Sending…" : "Email me a sign-in link"}</button>
        </form>
        <small className="muted">Only invited staff can sign in. Customer shipment links do not require an account.</small>
      </section>
    </main>
  );
}
