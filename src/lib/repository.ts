import type {
  Profile,
  PublicShipmentResponse,
  RouteSchemaV2,
  ShareLinkRecord,
  ShipmentRecord,
  ShipmentStatus,
  ShipmentSummary,
  StaffRole,
} from "../types";
import { requireSupabase, functionError } from "./supabase";
import { validateRoute } from "./route";

function metadata(route: RouteSchemaV2) {
  return {
    train_id: route.trainId,
    customer_name: route.customer,
    origin_name: route.stops[0]?.name || "",
    destination_name: route.stops.at(-1)?.name || "",
  };
}

export async function listShipments(): Promise<ShipmentSummary[]> {
  const { data, error } = await requireSupabase()
    .from("shipments")
    .select("id,train_id,customer_name,origin_name,destination_name,status,revision,updated_at,last_published_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []) as ShipmentSummary[];
}

export async function getShipment(id: string): Promise<ShipmentRecord> {
  const { data, error } = await requireSupabase().from("shipments").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ShipmentRecord;
}

export async function createShipment(route: RouteSchemaV2): Promise<ShipmentRecord> {
  const errors = validateRoute(route);
  if (errors.length) throw new Error(errors.join(" "));
  const user = (await requireSupabase().auth.getUser()).data.user;
  if (!user) throw new Error("You must sign in before creating a shipment.");
  const { data, error } = await requireSupabase().from("shipments").insert({
    ...metadata(route),
    draft_data: route,
    status: "active",
    created_by: user.id,
    updated_by: user.id,
  }).select("*").single();
  if (error) throw error;
  return data as ShipmentRecord;
}

export async function saveShipmentDraft(
  id: string,
  expectedRevision: number,
  route: RouteSchemaV2,
  status: ShipmentStatus,
): Promise<ShipmentRecord> {
  const errors = validateRoute(route);
  if (errors.length) throw new Error(errors.join(" "));
  const { data, error } = await requireSupabase().rpc("save_shipment_draft", {
    p_shipment_id: id,
    p_expected_revision: expectedRevision,
    p_draft: route,
    p_status: status,
  });
  if (error) {
    if (error.code === "40001" || /revision conflict/i.test(error.message)) {
      throw new Error("REVISION_CONFLICT");
    }
    throw error;
  }
  return data as ShipmentRecord;
}

export async function setShipmentStatus(id: string, status: ShipmentStatus): Promise<void> {
  const { error } = await requireSupabase().rpc("set_shipment_status", { p_shipment_id: id, p_status: status });
  if (error) throw error;
}

export async function publishShipment(id: string, expectedRevision: number): Promise<{ version: number; publishedAt: string }> {
  const { data, error } = await requireSupabase().functions.invoke("publish-shipment", {
    body: { shipmentId: id, expectedRevision },
  });
  if (error) throw functionError(error, "The shipment could not be published.");
  if (!data?.ok) throw new Error(data?.error || "The shipment could not be published.");
  return { version: data.version, publishedAt: data.publishedAt };
}

export async function getActiveShareLink(shipmentId: string): Promise<ShareLinkRecord | null> {
  const { data, error } = await requireSupabase()
    .from("share_links")
    .select("id,shipment_id,expires_at,revoked_at,created_at,last_accessed_at")
    .eq("shipment_id", shipmentId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ShareLinkRecord | null;
}

export async function manageShareLink(input: {
  action: "create" | "revoke" | "update-expiration";
  shipmentId: string;
  linkId?: string;
  expiresAt?: string | null;
}): Promise<{ link?: ShareLinkRecord; token?: string }> {
  const { data, error } = await requireSupabase().functions.invoke("manage-share-link", { body: input });
  if (error) throw functionError(error, "The share link could not be updated.");
  if (!data?.ok) throw new Error(data?.error || "The share link could not be updated.");
  return data;
}

export async function getPublicShipment(token: string): Promise<PublicShipmentResponse> {
  const { data, error } = await requireSupabase().functions.invoke("get-public-shipment", { body: { token } });
  if (error || !data?.ok) throw new Error("Shipment link unavailable");
  return { shipment: data.shipment as RouteSchemaV2, publishedAt: data.publishedAt };
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const user = (await requireSupabase().auth.getUser()).data.user;
  if (!user) return null;
  const { data, error } = await requireSupabase().from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function listStaff(): Promise<Profile[]> {
  const { data, error } = await requireSupabase().from("profiles").select("*").order("email");
  if (error) throw error;
  return (data || []) as Profile[];
}

export async function inviteStaff(email: string, role: StaffRole): Promise<void> {
  const { data, error } = await requireSupabase().functions.invoke("invite-staff", { body: { action: "invite", email, role } });
  if (error) throw functionError(error, "The invitation could not be sent.");
  if (!data?.ok) throw new Error(data?.error || "The invitation could not be sent.");
}

export async function updateStaff(id: string, role: StaffRole, active: boolean): Promise<void> {
  const { data, error } = await requireSupabase().functions.invoke("invite-staff", { body: { action: "update", userId: id, role, active } });
  if (error) throw functionError(error, "Staff access could not be updated.");
  if (!data?.ok) throw new Error(data?.error || "Staff access could not be updated.");
}
