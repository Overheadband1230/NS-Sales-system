import { json, preflight, readJson } from "../_shared/http.ts";
import { requireActiveUser } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  try {
    const body = await readJson(request);
    const shipmentId = String(body.shipmentId || "");
    const expectedRevision = Number(body.expectedRevision);
    if (!/^[0-9a-f-]{36}$/i.test(shipmentId) || !Number.isInteger(expectedRevision) || expectedRevision < 1) return json(request, { ok: false, error: "Invalid publication request" }, 400);
    const { client } = await requireActiveUser(request);
    const { data, error } = await client.rpc("publish_shipment_snapshot", {
      p_shipment_id: shipmentId,
      p_expected_revision: expectedRevision,
    });
    if (error) {
      const conflict = error.code === "40001" || /revision conflict/i.test(error.message);
      return json(request, { ok: false, error: conflict ? "A newer draft exists. Reload before publishing." : error.message }, conflict ? 409 : 400);
    }
    return json(request, { ok: true, ...data });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "AUTH_REQUIRED";
    return json(request, { ok: false, error: unauthorized ? "Staff access required" : "The shipment could not be published" }, unauthorized ? 401 : 500);
  }
});
