import type {
  Coordinates,
  LegacyRoute,
  RailEdge,
  RouteSchemaV2,
  ShipmentStop,
  TimingState,
} from "../types";

const MAX_STOPS = 100;
const MAX_SEGMENT_POINTS = 20_000;
const MAX_RAIL_SNAP_MILES = 25;

function text(value: unknown, max: number): string {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

function numberInRange(value: unknown, min: number, max: number, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function makeStop(index: number, overrides: Partial<ShipmentStop> = {}): ShipmentStop {
  const id = overrides.id || `stop-${crypto.randomUUID?.() ?? `${Date.now()}-${index}`}`;
  return {
    id,
    name: overrides.name ?? `Stop ${index + 1}`,
    coords: overrides.coords ?? [40, -82],
    type: overrides.type ?? (index === 0 ? "Origin" : "Destination"),
    major: overrides.major ?? false,
    scheduledAt: overrides.scheduledAt ?? "",
    projectedAt: overrides.projectedAt ?? "",
    timingState: overrides.timingState ?? "none",
    customerNote: overrides.customerNote ?? "",
    internalNote: overrides.internalNote ?? "",
    via: overrides.via ?? [],
  };
}

export function createBlankRoute(): RouteSchemaV2 {
  const origin = makeStop(0, { name: "", coords: [Number.NaN, Number.NaN], type: "Origin" });
  const destination = makeStop(1, { name: "", coords: [Number.NaN, Number.NaN], type: "Destination" });
  return {
    schemaVersion: 2,
    carrier: "Norfolk Southern · Shipment Tracker",
    trainId: "",
    customer: "",
    commodity: "",
    cars: 0,
    updatedAt: localDateTime(),
    timezone: "ET",
    currentPosition: { mode: "stop", stopId: origin.id },
    routeSegments: {},
    stops: [origin, destination],
  };
}

export function localDateTime(date = new Date()): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function validCoordinates(value: unknown): value is Coordinates {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1])) &&
    Number(value[0]) >= -90 &&
    Number(value[0]) <= 90 &&
    Number(value[1]) >= -180 &&
    Number(value[1]) <= 180
  );
}

function cleanGeometry(value: unknown, limit = MAX_SEGMENT_POINTS): Coordinates[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, limit).filter(validCoordinates).map((point) => [Number(point[0]), Number(point[1])]);
}

function slug(value: string, fallback: string): string {
  return text(value, 80).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || fallback;
}

function normalizeStop(value: unknown, index: number): ShipmentStop {
  const stop = value && typeof value === "object" ? (value as Partial<ShipmentStop>) : {};
  const timingState: TimingState = ["actual", "estimated", "none"].includes(String(stop.timingState))
    ? (stop.timingState as TimingState)
    : "none";
  return {
    id: text(stop.id || slug(String(stop.name || ""), `stop-${index + 1}`), 80),
    name: text(stop.name || `Stop ${index + 1}`, 200),
    coords: validCoordinates(stop.coords) ? [Number(stop.coords[0]), Number(stop.coords[1])] : [Number.NaN, Number.NaN],
    type: text(stop.type || "Waypoint", 80),
    major: Boolean(stop.major),
    scheduledAt: text(stop.scheduledAt, 40),
    projectedAt: text(stop.projectedAt, 40),
    timingState,
    customerNote: text(stop.customerNote, 2_000),
    internalNote: text(stop.internalNote, 2_000),
    via: cleanGeometry(stop.via, 500),
  };
}

function legacyDate(value: unknown, year: number): string {
  if (!value) return "";
  const months: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  const match = String(value).match(/^([A-Za-z]{3})\s+(\d{1,2})(?:,\s*(\d{4}))?\s*·\s*(\d{1,2}):(\d{2})/);
  if (!match || !months[match[1]]) return "";
  return `${match[3] || year}-${String(months[match[1]]).padStart(2, "0")}-${match[2].padStart(2, "0")}T${match[4].padStart(2, "0")}:${match[5]}`;
}

export function migrateRoute(raw: unknown): RouteSchemaV2 {
  if (raw && typeof raw === "object" && (raw as { schemaVersion?: number }).schemaVersion === 2) {
    const value = raw as Partial<RouteSchemaV2>;
    const stops = Array.isArray(value.stops) ? value.stops.slice(0, MAX_STOPS).map(normalizeStop) : [];
    const incoming = value.routeSegments && typeof value.routeSegments === "object" && !Array.isArray(value.routeSegments) ? value.routeSegments : {};
    const routeSegments: Record<string, Coordinates[]> = {};
    Object.entries(incoming).slice(0, 200).forEach(([key, geometry]) => {
      const cleaned = cleanGeometry(geometry);
      if (cleaned.length > 1) routeSegments[text(key, 200)] = cleaned;
    });
    const position = value.currentPosition?.mode === "leg"
      ? {
          mode: "leg" as const,
          fromStopId: text(value.currentPosition.fromStopId, 80),
          toStopId: text(value.currentPosition.toStopId, 80),
          progress: numberInRange(value.currentPosition.progress, 0, 1),
        }
      : { mode: "stop" as const, stopId: text(value.currentPosition?.stopId, 80) };
    return {
      schemaVersion: 2,
      carrier: text(value.carrier || "Norfolk Southern · Shipment Tracker", 200),
      trainId: text(value.trainId, 120),
      customer: text(value.customer, 200),
      commodity: text(value.commodity, 200),
      cars: Math.round(numberInRange(value.cars, 0, 9_999)),
      updatedAt: text(value.updatedAt, 40),
      timezone: text(value.timezone || "ET", 12),
      currentPosition: position,
      routeSegments,
      stops,
    };
  }

  const legacy = raw as LegacyRoute;
  if (!legacy || !Array.isArray(legacy.stops)) throw new Error("This route file has no stops.");
  const match = String(legacy.updated || "").match(/(\d{4})/);
  const year = match ? Number(match[1]) : new Date().getFullYear();
  const timezone = (String(legacy.updated || "").match(/\b([ECMP]T)\b/) || [])[1] || "ET";
  const stops = legacy.stops.slice(0, MAX_STOPS).map((stop, index) => normalizeStop({
    id: `${slug(stop.name || "stop", "stop")}-${index + 1}`,
    name: stop.name,
    coords: stop.coords,
    type: stop.type,
    major: stop.major,
    scheduledAt: legacyDate(stop.eta, year),
    projectedAt: legacyDate(stop.act, year),
    timingState: /est/i.test(stop.act || "") ? "estimated" : "actual",
    customerNote: stop.note,
    internalNote: "",
    via: stop.via,
  }, index));
  let currentIndex = legacy.stops.findIndex((stop) => stop.status === "current");
  if (currentIndex < 0) currentIndex = Math.max(0, legacy.stops.map((stop) => stop.status).lastIndexOf("done"));
  const routeSegments: Record<string, Coordinates[]> = {};
  if (Array.isArray(legacy.routeSegments)) {
    for (let index = 0; index < stops.length - 1; index += 1) {
      const geometry = cleanGeometry(legacy.routeSegments[index + 1]);
      if (geometry.length > 1) routeSegments[legKey(stops[index].id, stops[index + 1].id)] = geometry;
    }
  }
  return {
    schemaVersion: 2,
    carrier: text(legacy.carrier || "Norfolk Southern · Shipment Tracker", 200),
    trainId: text(legacy.trainId, 120),
    customer: text(legacy.customer, 200),
    commodity: text(legacy.commodity, 200),
    cars: Math.round(numberInRange(legacy.cars, 0, 9_999)),
    updatedAt: legacyDate(legacy.updated, year),
    timezone,
    currentPosition: { mode: "stop", stopId: stops[Math.min(currentIndex, stops.length - 1)]?.id || "" },
    routeSegments,
    stops,
  };
}

export function validateRoute(route: RouteSchemaV2): string[] {
  const errors: string[] = [];
  if (route.schemaVersion !== 2) errors.push("Route schema must be version 2.");
  if (!route.trainId.trim()) errors.push("Train or shipment ID is required.");
  if (!route.customer.trim()) errors.push("Customer is required.");
  if (!route.updatedAt) errors.push("Last-updated time is required.");
  if (!route.timezone.trim()) errors.push("Timezone is required.");
  if (route.stops.length < 2) errors.push("At least two stops are required.");
  if (route.stops.length > MAX_STOPS) errors.push(`Routes may contain no more than ${MAX_STOPS} stops.`);
  const ids = new Set<string>();
  route.stops.forEach((stop, index) => {
    if (!stop.id || ids.has(stop.id)) errors.push(`Stop ${index + 1} must have a unique ID.`);
    ids.add(stop.id);
    if (!stop.name.trim()) errors.push(`Stop ${index + 1} needs a name.`);
    if (!validCoordinates(stop.coords)) errors.push(`Stop ${index + 1} has invalid coordinates.`);
  });
  if (route.currentPosition.mode === "stop" && !ids.has(route.currentPosition.stopId)) errors.push("Current stop is not part of this route.");
  if (route.currentPosition.mode === "leg") {
    const position = route.currentPosition;
    const from = route.stops.findIndex((stop) => stop.id === position.fromStopId);
    if (from < 0 || route.stops[from + 1]?.id !== position.toStopId) errors.push("Current leg is not part of this route.");
  }
  return errors;
}

export function sanitizeForCustomer(route: RouteSchemaV2): RouteSchemaV2 {
  const copy = structuredClone(route);
  copy.stops = copy.stops.map((stop) => {
    const sanitized = { ...stop } as Partial<ShipmentStop>;
    delete sanitized.internalNote;
    return sanitized as ShipmentStop;
  });
  return copy;
}

export function legKey(fromStopId: string, toStopId: string): string {
  return `${fromStopId}__${toStopId}`;
}

export function legGeometry(route: RouteSchemaV2, index: number): Coordinates[] {
  const from = route.stops[index];
  const to = route.stops[index + 1];
  if (!from || !to) return [];
  const geometry = route.routeSegments[legKey(from.id, to.id)];
  if (!geometry || geometry.length < 2) return [];
  if (distanceMiles(geometry[0], from.coords) > MAX_RAIL_SNAP_MILES) return [];
  if (distanceMiles(geometry.at(-1)!, to.coords) > MAX_RAIL_SNAP_MILES) return [];
  return geometry;
}

export function routeLegGeometries(route: RouteSchemaV2): Coordinates[][] {
  return route.stops.slice(0, -1).map((_, index) => legGeometry(route, index)).filter((leg) => leg.length > 1);
}

export function unroutedLegs(route: RouteSchemaV2): string[] {
  return route.stops.slice(0, -1).flatMap((stop, index) => (
    legGeometry(route, index).length > 1 ? [] : [`${stop.name} → ${route.stops[index + 1].name}`]
  ));
}

export function routeGeometry(route: RouteSchemaV2): Coordinates[] {
  return routeLegGeometries(route).flat();
}

export function routeMiles(route: RouteSchemaV2): number {
  return routeLegGeometries(route).reduce((total, leg) => total + geometryMiles(leg), 0);
}

export function distanceMiles(a: Coordinates, b: Coordinates): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b[0] - a[0]);
  const dLng = toRadians(b[1] - a[1]);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a[0])) * Math.cos(toRadians(b[0])) * Math.sin(dLng / 2) ** 2;
  return 3_958.8 * 2 * Math.asin(Math.sqrt(value));
}

export function geometryMiles(points: Coordinates[]): number {
  return points.slice(1).reduce((total, point, index) => total + distanceMiles(points[index], point), 0);
}

export function currentPositionLabel(route: RouteSchemaV2): string {
  const position = route.currentPosition;
  if (position.mode === "stop") return route.stops.find((stop) => stop.id === position.stopId)?.name || "Unknown position";
  const from = route.stops.find((stop) => stop.id === position.fromStopId);
  const to = route.stops.find((stop) => stop.id === position.toStopId);
  return from && to ? `${Math.round(position.progress * 100)}% from ${from.name} to ${to.name}` : "Unknown position";
}

export function currentCoordinates(route: RouteSchemaV2): Coordinates | null {
  const position = route.currentPosition;
  if (position.mode === "stop") return route.stops.find((stop) => stop.id === position.stopId)?.coords || null;
  const index = route.stops.findIndex((stop) => stop.id === position.fromStopId);
  const points = legGeometry(route, index);
  if (!points.length) return null;
  const target = geometryMiles(points) * position.progress;
  let travelled = 0;
  for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
    const segment = distanceMiles(points[pointIndex - 1], points[pointIndex]);
    if (travelled + segment >= target) {
      const ratio = segment ? (target - travelled) / segment : 0;
      return [
        points[pointIndex - 1][0] + (points[pointIndex][0] - points[pointIndex - 1][0]) * ratio,
        points[pointIndex - 1][1] + (points[pointIndex][1] - points[pointIndex - 1][1]) * ratio,
      ];
    }
    travelled += segment;
  }
  return points.at(-1) || null;
}

export interface RailGraph {
  nodes: Map<number, Coordinates>;
  adjacent: Map<number, Array<{ id: number; miles: number; geometry: Coordinates[] }>>;
}

export function buildRailGraph(edges: RailEdge[]): RailGraph {
  const nodes = new Map<number, Coordinates>();
  const adjacent = new Map<number, Array<{ id: number; miles: number; geometry: Coordinates[] }>>();
  edges.forEach(([from, to, geometry]) => {
    if (geometry.length < 2) return;
    nodes.set(from, geometry[0]);
    nodes.set(to, geometry.at(-1)!);
    const miles = geometryMiles(geometry);
    adjacent.set(from, [...(adjacent.get(from) || []), { id: to, miles, geometry }]);
    adjacent.set(to, [...(adjacent.get(to) || []), { id: from, miles, geometry: [...geometry].reverse() }]);
  });
  return { nodes, adjacent };
}

function nearestNodes(graph: RailGraph, point: Coordinates, count = 3): number[] {
  return [...graph.nodes.entries()]
    .map(([id, coords]) => ({ id, distance: (coords[0] - point[0]) ** 2 + (coords[1] - point[1]) ** 2 }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map(({ id }) => id);
}

function shortestPath(graph: RailGraph, source: number, target: number): number[] | null {
  const distance = new Map<number, number>([[source, 0]]);
  const previous = new Map<number, number>();
  const queue: Array<[number, number]> = [[0, source]];
  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0]);
    const [cost, current] = queue.shift()!;
    if (current === target) break;
    if (cost > (distance.get(current) ?? Number.POSITIVE_INFINITY)) continue;
    (graph.adjacent.get(current) || []).forEach((edge) => {
      const nextCost = cost + edge.miles;
      if (nextCost < (distance.get(edge.id) ?? Number.POSITIVE_INFINITY)) {
        distance.set(edge.id, nextCost);
        previous.set(edge.id, current);
        queue.push([nextCost, edge.id]);
      }
    });
  }
  if (!distance.has(target)) return null;
  const result = [target];
  while (result[0] !== source) {
    const prior = previous.get(result[0]);
    if (prior === undefined) return null;
    result.unshift(prior);
  }
  return result;
}

export function routeBetween(graph: RailGraph, from: Coordinates, to: Coordinates): Coordinates[] | null {
  const fromNodes = nearestNodes(graph, from).filter((id) => distanceMiles(from, graph.nodes.get(id)!) <= MAX_RAIL_SNAP_MILES);
  const toNodes = nearestNodes(graph, to).filter((id) => distanceMiles(to, graph.nodes.get(id)!) <= MAX_RAIL_SNAP_MILES);
  if (!fromNodes.length || !toNodes.length) return null;
  const direct = distanceMiles(from, to);
  let best: { miles: number; geometry: Coordinates[] } | null = null;
  fromNodes.forEach((source) => toNodes.forEach((target) => {
    if (source === target) return;
    const path = shortestPath(graph, source, target);
    if (!path) return;
    let miles = 0;
    let geometry: Coordinates[] = [];
    for (let index = 0; index < path.length - 1; index += 1) {
      const edge = graph.adjacent.get(path[index])?.find((item) => item.id === path[index + 1]);
      if (!edge) return;
      miles += edge.miles;
      geometry = geometry.length ? geometry.concat(edge.geometry.slice(1)) : [...edge.geometry];
    }
    if (miles <= Math.max(direct * 3, direct + 15) && (!best || miles < best.miles)) best = { miles, geometry };
  }));
  const result = best as { miles: number; geometry: Coordinates[] } | null;
  return result ? result.geometry : null;
}

export function autoRoute(route: RouteSchemaV2, edges: RailEdge[]): RouteSchemaV2 {
  const next = structuredClone(route);
  const graph = buildRailGraph(edges);
  next.routeSegments = {};
  for (let index = 0; index < next.stops.length - 1; index += 1) {
    const from = next.stops[index];
    const to = next.stops[index + 1];
    const geometry = routeBetween(graph, from.coords, to.coords);
    if (geometry) next.routeSegments[legKey(from.id, to.id)] = geometry;
  }
  return next;
}

export function downloadRoute(route: RouteSchemaV2): void {
  const blob = new Blob([JSON.stringify(route, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `route_${(route.trainId || "shipment").replace(/[^a-z0-9_-]+/gi, "_")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
