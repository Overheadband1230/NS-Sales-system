import type { RailEdge, RouteSchemaV2 } from "../types";
import { describe, expect, it } from "vitest";
import {
  autoRoute,
  createBlankRoute,
  legGeometry,
  makeStop,
  migrateRoute,
  routeLegGeometries,
  routeMiles,
  sanitizeForCustomer,
  shiftDownstreamSchedules,
  unroutedLegs,
  validateRoute,
} from "./route";

const network: RailEdge[] = [
  [1, 2, [[41, -84], [41.1, -83.5], [41, -83]]],
  [2, 3, [[41, -83], [40.9, -82.5], [41, -82]]],
];

function route(from: [number, number], to: [number, number]): RouteSchemaV2 {
  const origin = makeStop(0, { id: "origin", name: "Origin", coords: from, type: "Origin" });
  const destination = makeStop(1, { id: "destination", name: "Destination", coords: to, type: "Destination" });
  return {
    schemaVersion: 2,
    carrier: "Norfolk Southern",
    trainId: "TEST",
    customer: "Test customer",
    commodity: "",
    cars: 1,
    updatedAt: "2026-09-01T12:00",
    timezone: "ET",
    currentPosition: { mode: "stop", stopId: origin.id },
    routeSegments: {},
    stops: [origin, destination],
  };
}

describe("rail-only route geometry", () => {
  it("does not draw a direct fallback when a leg has not been routed", () => {
    const draft = route([41, -84], [41, -82]);
    expect(legGeometry(draft, 0)).toEqual([]);
    expect(routeLegGeometries(draft)).toEqual([]);
    expect(routeMiles(draft)).toBe(0);
    expect(unroutedLegs(draft)).toEqual(["Origin → Destination"]);
  });

  it("uses the rail graph geometry instead of the stop-to-stop chord", () => {
    const draft = route([41.01, -84], [41.01, -82]);
    const routed = autoRoute(draft, network);
    const geometry = legGeometry(routed, 0);

    expect(unroutedLegs(routed)).toEqual([]);
    expect(geometry).toEqual([
      [41, -84],
      [41.1, -83.5],
      [41, -83],
      [40.9, -82.5],
      [41, -82],
    ]);
    expect(geometry[0]).not.toEqual(draft.stops[0].coords);
    expect(geometry.at(-1)).not.toEqual(draft.stops[1].coords);
  });

  it("leaves an off-network leg unrouted instead of inventing a line", () => {
    const routed = autoRoute(route([35, -100], [35, -98]), network);
    expect(legGeometry(routed, 0)).toEqual([]);
    expect(unroutedLegs(routed)).toEqual(["Origin → Destination"]);
  });
});

describe("Route Schema v2 portability and publication safety", () => {
  it("round-trips a valid version 2 route", () => {
    const draft = createBlankRoute();
    draft.trainId = "24V";
    draft.customer = "Example Customer";
    draft.stops[0] = { ...draft.stops[0], name: "Chicago, IL", coords: [41.85, -87.65] };
    draft.stops[1] = { ...draft.stops[1], name: "Philadelphia, PA", coords: [39.952, -75.163] };
    expect(validateRoute(draft)).toEqual([]);
    expect(migrateRoute(JSON.parse(JSON.stringify(draft)))).toEqual(draft);
  });

  it("reports missing required fields and an invalid current position", () => {
    const draft = createBlankRoute();
    draft.currentPosition = { mode: "stop", stopId: "missing" };
    expect(validateRoute(draft)).toEqual(expect.arrayContaining([
      "Train or shipment ID is required.",
      "Customer is required.",
      "Current stop is not part of this route.",
    ]));
  });

  it("removes internal-note keys from a customer snapshot", () => {
    const draft = createBlankRoute();
    draft.stops[0].internalNote = "staff only";
    expect(JSON.stringify(sanitizeForCustomer(draft))).not.toContain("internalNote");
  });

  it("migrates the original legacy route shape", () => {
    const migrated = migrateRoute({
      trainId: "LEGACY",
      customer: "Legacy Customer",
      updated: "Aug 14, 2026 · 08:15 ET",
      stops: [
        { name: "Chicago", coords: [41.85, -87.65], status: "done", eta: "Aug 14, 2026 · 08:15" },
        { name: "Cleveland", coords: [41.5, -81.6], status: "current", act: "Aug 15, 2026 · 09:30 est" },
      ],
    });
    expect(migrated.currentPosition).toEqual({ mode: "stop", stopId: migrated.stops[1].id });
    expect(migrated.stops[1].timingState).toBe("estimated");
  });
});

describe("route schedule updates", () => {
  it("keeps downstream intervals when the origin schedule changes", () => {
    const draft = route([41, -84], [41, -82]);
    draft.stops = [
      { ...draft.stops[0], scheduledAt: "2026-09-01T06:00" },
      makeStop(1, { id: "middle", scheduledAt: "2026-09-01T18:30" }),
      { ...draft.stops[1], scheduledAt: "2026-09-03T09:15" },
    ];
    const edited = draft.stops.map((stop, index) => index === 0
      ? { ...stop, scheduledAt: "2026-09-02T08:30" }
      : stop);

    const shifted = shiftDownstreamSchedules(edited, "2026-09-01T06:00", "2026-09-02T08:30");

    expect(shifted.map((stop) => stop.scheduledAt)).toEqual([
      "2026-09-02T08:30",
      "2026-09-02T21:00",
      "2026-09-04T11:45",
    ]);
  });

  it("leaves downstream schedules alone until both origin dates are valid", () => {
    const stops = [
      makeStop(0, { scheduledAt: "2026-09-01T06:00" }),
      makeStop(1, { scheduledAt: "2026-09-02T06:00" }),
    ];

    expect(shiftDownstreamSchedules(stops, "", "2026-09-01T06:00")).toBe(stops);
    expect(shiftDownstreamSchedules(stops, "2026-09-01T06:00", "")).toBe(stops);
  });
});
