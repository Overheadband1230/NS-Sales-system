import { json, preflight, readJson } from "../_shared/http.ts";
import { adminClient, randomToken, requireActiveUser, sha256 } from "../_shared/supabase.ts";

function validUuid(value: string): boolean { return /^[0-9a-f-]{36}$/i.test(value); }
function parseExpiration(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined || value === "") return undefined;
  const date = new Date(String(value));
  if (Number.isNaN(date.valueOf()) || date <= new Date()) throw new Error("Expiration must be in the future");
  return date.toISOString();
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  try {
    const body = await readJson(request);
    const action = String(body.action || "");
    const shipmentId = String(body.shipmentId || "");
    const linkId = String(body.linkId || "");
    if (!validUuid(shipmentId) || !["create", "revoke", "update-expiration"].includes(action)) return json(request, { ok: false, error: "Invalid share-link request" }, 400);
    const { user } = await requireActiveUser(request);
    const admin = adminClient();
    const { data: shipment } = await admin.from("shipments").select("id,status,last_published_at").eq("id", shipmentId).single();
    if (!shipment || shipment.status === "archived") return json(request, { ok: false, error: "Archived or missing shipment" }, 404);

    if (action === "create") {
      if (!shipment.last_published_at) return json(request, { ok: false, error: "Publish the shipment before sharing it" }, 400);
      const expiresAt = parseExpiration(body.expiresAt) ?? new Date(Date.now() + 30 * 86_400_000).toISOString();
      await admin.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("shipment_id", shipmentId).is("revoked_at", null);
      const token = randomToken();
      const { data: link, error } = await admin.from("share_links").insert({
        shipment_id: shipmentId,
        token_hash: await sha256(token),
        expires_at: expiresAt,
        created_by: user.id,
      }).select("id,shipment_id,expires_at,revoked_at,created_at,first_accessed_at,last_accessed_at,access_count").single();
      if (error) throw error;
      return json(request, { ok: true, link, token });
    }

    if (!validUuid(linkId)) return json(request, { ok: false, error: "Invalid link" }, 400);
    const { data: existing } = await admin.from("share_links").select("id").eq("id", linkId).eq("shipment_id", shipmentId).is("revoked_at", null).maybeSingle();
    if (!existing) return json(request, { ok: false, error: "Active link not found" }, 404);
    if (action === "revoke") {
      await admin.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("id", linkId);
      return json(request, { ok: true });
    }
    const expiresAt = parseExpiration(body.expiresAt);
    const { data: link, error } = await admin.from("share_links").update({ expires_at: expiresAt ?? null }).eq("id", linkId).select("id,shipment_id,expires_at,revoked_at,created_at,first_accessed_at,last_accessed_at,access_count").single();
    if (error) throw error;
    return json(request, { ok: true, link });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The share link could not be updated";
    const unauthorized = message === "AUTH_REQUIRED";
    return json(request, { ok: false, error: unauthorized ? "Staff access required" : message }, unauthorized ? 401 : 400);
  }
});
