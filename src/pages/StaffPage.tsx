import { useEffect, useState, type FormEvent } from "react";
import type { Profile, StaffRole } from "../types";
import { inviteStaff, listStaff, updateStaff } from "../lib/repository";
import { Notice } from "../components/Notice";

export function StaffPage() {
  const [staff, setStaff] = useState<Profile[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("editor");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function reload() {
    try { setStaff(await listStaff()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Staff could not be loaded."); }
  }
  useEffect(() => { void reload(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    try { await inviteStaff(email.trim(), role); setEmail(""); setMessage(`Invitation sent to ${email}.`); await reload(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Invitation failed."); }
  }

  async function change(profile: Profile, updates: Partial<Pick<Profile, "role" | "active">>) {
    setError("");
    try { await updateStaff(profile.id, updates.role || profile.role, updates.active ?? profile.active); await reload(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Staff access could not be updated."); }
  }

  return (
    <>
      <section className="page-heading"><div><p className="eyebrow">Administration</p><h1>Staff access</h1><p className="muted">Only invited, active staff can see shipment drafts.</p></div></section>
      {message && <Notice tone="success">{message}</Notice>}{error && <Notice tone="error">{error}</Notice>}
      <section className="settings-grid">
        <form className="panel" onSubmit={submit}><h2>Invite staff</h2><label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Role<select value={role} onChange={(event) => setRole(event.target.value as StaffRole)}><option value="editor">Editor</option><option value="admin">Admin</option></select></label><button className="button primary">Send invitation</button></form>
        <section className="panel staff-list"><h2>Workspace members</h2>{staff.map((profile) => <article key={profile.id}><div><strong>{profile.display_name || profile.email}</strong><small>{profile.email}</small></div><select aria-label={`Role for ${profile.email}`} value={profile.role} onChange={(event) => void change(profile, { role: event.target.value as StaffRole })}><option value="editor">Editor</option><option value="admin">Admin</option></select><label className="toggle"><input type="checkbox" checked={profile.active} onChange={(event) => void change(profile, { active: event.target.checked })} /> Active</label></article>)}</section>
      </section>
    </>
  );
}
