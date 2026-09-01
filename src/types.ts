export type Coordinates = [number, number];

export type TimingState = "actual" | "estimated" | "none";
export type ShipmentStatus = "active" | "delivered" | "archived";
export type StaffRole = "admin" | "editor";

export interface ShipmentStop {
  id: string;
  name: string;
  coords: Coordinates;
  type: string;
  major: boolean;
  scheduledAt: string;
  projectedAt: string;
  timingState: TimingState;
  customerNote: string;
  internalNote: string;
  via: Coordinates[];
}

export type CurrentPosition =
  | { mode: "stop"; stopId: string }
  | { mode: "leg"; fromStopId: string; toStopId: string; progress: number };

export interface RouteSchemaV2 {
  schemaVersion: 2;
  carrier: string;
  trainId: string;
  customer: string;
  commodity: string;
  cars: number;
  updatedAt: string;
  timezone: string;
  currentPosition: CurrentPosition;
  routeSegments: Record<string, Coordinates[]>;
  stops: ShipmentStop[];
}

export interface LegacyRoute {
  carrier?: string;
  trainId?: string;
  customer?: string;
  commodity?: string;
  cars?: number;
  updated?: string;
  routeSegments?: Coordinates[][];
  stops?: Array<{
    name?: string;
    coords?: Coordinates;
    type?: string;
    major?: boolean;
    eta?: string;
    act?: string;
    note?: string;
    via?: Coordinates[];
    status?: string;
  }>;
}

export interface ShipmentSummary {
  id: string;
  train_id: string;
  customer_name: string;
  origin_name: string;
  destination_name: string;
  status: ShipmentStatus;
  revision: number;
  updated_at: string;
  last_published_at: string | null;
}

export interface ShipmentRecord extends ShipmentSummary {
  draft_data: RouteSchemaV2;
  created_at: string;
  created_by: string;
  updated_by: string;
}

export interface Publication {
  id: string;
  shipment_id: string;
  version: number;
  snapshot: RouteSchemaV2;
  published_at: string;
}

export interface ShareLinkRecord {
  id: string;
  shipment_id: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  last_accessed_at: string | null;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: StaffRole;
  active: boolean;
  created_at: string;
}

export interface PublicShipmentResponse {
  shipment: RouteSchemaV2;
  publishedAt: string;
}

export type RailEdge = [number, number, Coordinates[]];
