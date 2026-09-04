import { json, preflight, readJson } from "../_shared/http.ts";
import { adminClient, requireActiveUser } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  try {
    const body = await readJson(request);
    const { user, profile } = await requireActiveUser(request);
    if (profile.role !== "admin") return json(request, { ok: false, error: "Administrator access required" }, 403);
    const action = String(body.action || "");
    const role = body.role === "admin" ? "admin" : "editor";
    const admin = adminClient();

    if (action === "invite") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(request, { ok: false, error: "Enter a valid email address" }, 400);
      const redirectTo = Deno.env.get("APP_SITE_URL") || "https://ns.cgmoye.com/#/settings/account";
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
      if (error || !data.user) return json(request, { ok: false, error: error?.message || "Invitation failed" }, 400);
      await admin.from("profiles").upsert({ id: data.user.id, email, role, active: true, updated_at: new Date().toISOString() });
      return json(request, { ok: true });
    }

    if (action === "update") {
      const userId = String(body.userId || "");
      const active = body.active === true;
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return json(request, { ok: false, error: "Invalid staff member" }, 400);
      if (userId === user.id && (!active || role !== "admin")) return json(request, { ok: false, error: "You cannot remove your own administrator access" }, 400);
      const { error } = await admin.from("profiles").update({ role, active, updated_at: new Date().toISOString() }).eq("id", userId);
      if (error) throw error;
      return json(request, { ok: true });
    }

    return json(request, { ok: false, error: "Invalid staff action" }, 400);
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "AUTH_REQUIRED";
    return json(request, { ok: false, error: unauthorized ? "Staff access required" : "Staff access could not be updated" }, unauthorized ? 401 : 500);
  }
});
