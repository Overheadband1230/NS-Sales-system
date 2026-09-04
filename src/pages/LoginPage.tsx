import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { Notice } from "../components/Notice";

type SignInFailure = {
  status?: number;
  code?: string;
};

export function signInFailureMessage(error: SignInFailure): string {
  if (error.status === 429 || error.code === "over_email_send_rate_limit") {
    return "Too many sign-in emails were requested. Wait up to one hour, then request one new link.";
  }
  if (error.code === "email_address_not_authorized") {
    return "Email delivery is not configured for this address. Ask an administrator to configure the production email service.";
  }
  return "That email is not invited, or the sign-in link could not be sent.";
}

export function LoginPage() {
  const { session, profile, configured, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<"password" | "magic-link">("password");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  if (!loading && session && profile?.active) return <Navigate to="/shipments" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setSending(true); setError(""); setMessage("");
    const address = email.trim();
    const signInError = method === "password"
      ? (await supabase.auth.signInWithPassword({ email: address, password })).error
      : (await supabase.auth.signInWithOtp({
          email: address,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: `${window.location.origin}${window.location.pathname}#/shipments`,
          },
        })).error;
    setSending(false);
    if (signInError) {
      setError(method === "password"
        ? "The email or password is incorrect, or this account has not been activated."
        : signInFailureMessage(signInError));
    } else if (method === "magic-link") {
      setMessage("Check your email for a secure sign-in link.");
    }
  }

  function switchMethod(next: "password" | "magic-link") {
    setMethod(next);
    setError("");
    setMessage("");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">NS</div>
        <p className="eyebrow">Secure staff workspace</p>
        <h1>Shipment updates from anywhere.</h1>
        <p className="muted">Sign in with an invited staff account.</p>
        {!configured && <Notice tone="error">This deployment is not connected to Supabase. Add the project URL and publishable key before signing in.</Notice>}
        {!loading && session && !profile && <Notice tone="error">Your password was accepted, but this account does not have an active staff profile. An administrator must activate it.</Notice>}
        {!loading && session && profile && !profile.active && <Notice tone="error">Your password was accepted, but this account has not been activated by an administrator.</Notice>}
        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <form onSubmit={submit}>
          <label>Email address<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label>
          {method === "password" && <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
          <button className="button primary full" disabled={!configured || sending}>
            {sending ? (method === "password" ? "Signing in…" : "Sending…") : (method === "password" ? "Sign in" : "Email me a sign-in link")}
          </button>
        </form>
        <button className="text-button auth-method-toggle" type="button" onClick={() => switchMethod(method === "password" ? "magic-link" : "password")}>
          {method === "password" ? "Use an email sign-in link instead" : "Sign in with a password instead"}
        </button>
        <small className="muted auth-footnote">Only invited staff can sign in. Customer shipment links do not require an account.</small>
      </section>
    </main>
  );
}
