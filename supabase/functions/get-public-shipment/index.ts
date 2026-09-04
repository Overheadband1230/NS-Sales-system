import { json, preflight, publicError, readJson } from "../_shared/http.ts";
import { adminClient, sha256 } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  try {
    const body = await readJson(request);
    const token = String(body.token || "");
    if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return publicError(request);
    const admin = adminClient();
    const { data: link } = await admin.from("share_links").select("id,shipment_id,expires_at,revoked_at").eq("token_hash", await sha256(token)).maybeSingle();
    if (!link || link.revoked_at || (link.expires_at && new Date(link.expires_at) <= new Date())) return publicError(request);
    const { data: shipment } = await admin.from("shipments").select("status").eq("id", link.shipment_id).maybeSingle();
    if (!shipment || shipment.status === "archived") return publicError(request);
    const { data: publication } = await admin.from("shipment_publications").select("snapshot,published_at").eq("shipment_id", link.shipment_id).order("version", { ascending: false }).limit(1).maybeSingle();
    if (!publication) return publicError(request);
    await admin.rpc("record_share_link_access", { p_link_id: link.id });
    return json(request, { ok: true, shipment: publication.snapshot, publishedAt: publication.published_at });
  } catch (_error) {
    return publicError(request);
  }
});
