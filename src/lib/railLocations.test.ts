import { describe, expect, it } from "vitest";
import { searchRailLocations, type RailLocation } from "./railLocations";

const locations: RailLocation[] = [
  { id: "1", city: "Atlanta", state: "GA", name: "Atlanta, GA", coords: [33.77, -84.4], railDistanceMiles: 1.1 },
  { id: "2", city: "Atlanta", state: "IL", name: "Atlanta, IL", coords: [40.45, -88.98], railDistanceMiles: 18.8 },
  { id: "3", city: "Roanoke", state: "VA", name: "Roanoke, VA", coords: [37.27, -79.96], railDistanceMiles: 0.1 },
];

describe("searchRailLocations", () => {
  it("finds cities by a partial name", () => {
    expect(searchRailLocations(locations, "roa").map((item) => item.name)).toEqual(["Roanoke, VA"]);
  });

  it("uses the state to disambiguate duplicate city names", () => {
    expect(searchRailLocations(locations, "atlanta ga").map((item) => item.name)).toEqual(["Atlanta, GA"]);
  });

  it("orders an exact city match by proximity to rail", () => {
    expect(searchRailLocations(locations, "atlanta").map((item) => item.name)).toEqual(["Atlanta, GA", "Atlanta, IL"]);
  });

  it("waits for at least two search characters", () => {
    expect(searchRailLocations(locations, "a")).toEqual([]);
  });
});
