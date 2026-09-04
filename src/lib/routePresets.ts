import type { Coordinates, RouteSchemaV2, ShipmentStop } from "../types";
import { makeStop } from "./route";

interface PresetLocation {
  coords: Coordinates;
  type?: string;
  major?: boolean;
}

interface RoutePreset {
  id: string;
  name: string;
  forwardSymbol: string;
  reverseSymbol: string;
  oneWay?: boolean;
  stops: string[];
}

export interface RoutePresetChoice {
  id: string;
  label: string;
}

const locations: Record<string, PresetLocation> = {
  "Chicago, IL": { coords: [41.85, -87.65], type: "Interchange Hub", major: true },
  "Fort Wayne, IN": { coords: [41.079, -85.139] },
  "Cleveland, OH": { coords: [41.505, -81.681] },
  "Conway Yard, PA": { coords: [40.664, -80.24], type: "Classification Yard", major: true },
  "Altoona, PA": { coords: [40.519, -78.395] },
  "Harrisburg, PA": { coords: [40.273, -76.884] },
  "Philadelphia, PA": { coords: [39.952, -75.163] },
  "Toledo, OH": { coords: [41.664, -83.555] },
  "Elkhart, IN": { coords: [41.6692, -86.009], type: "Classification Yard", major: true },
  "Abrams, PA": { coords: [40.11476, -75.3782], type: "Classification Yard", major: true },
  "Roanoke, VA": { coords: [37.271, -79.941] },
  "Norfolk, VA": { coords: [36.846, -76.285] },
  "Atlanta, GA": { coords: [33.749, -84.388] },
  "Birmingham, AL": { coords: [33.521, -86.809] },
  "Chicago 47th, IL": { coords: [41.81, -87.64], type: "Interchange Hub", major: true },
  "Chicago Calumet, IL": { coords: [41.65, -87.54], type: "Interchange Hub", major: true },
  "Chicago Landers, IL": { coords: [41.779, -87.642], type: "Interchange Hub", major: true },
  "Croxton, NJ": { coords: [40.755, -74.074], type: "Interchange Hub", major: true },
  "Austell, GA": { coords: [33.78, -84.66], type: "Interchange Hub", major: true },
  "Rossville, TN": { coords: [35.039, -89.543], type: "Interchange Hub", major: true },
  "Rutherford, PA": { coords: [40.23, -76.73], type: "Interchange Hub", major: true },
  "Bethlehem, PA": { coords: [40.626, -75.371], type: "Interchange Hub", major: true },
  "Jacksonville, FL": { coords: [30.332, -81.656], type: "Interchange Hub", major: true },
  "Savannah, GA": { coords: [32.081, -81.091], type: "Interchange Hub", major: true },
  "Columbus, OH": { coords: [39.961, -82.999] },
  "Cincinnati, OH": { coords: [39.103, -84.512] },
  "Knoxville, TN": { coords: [35.961, -83.921] },
  "Chattanooga, TN": { coords: [35.046, -85.31] },
  "Macon, GA": { coords: [32.841, -83.632] },
  "Charlotte, NC": { coords: [35.227, -80.843] },
  "Greensboro, NC": { coords: [36.073, -79.792] },
};

const routePresets: RoutePreset[] = [
  { id: "crude-chicago-philadelphia", name: "Crude unit train · Chicago → Philadelphia", forwardSymbol: "Crude unit train", reverseSymbol: "Crude unit train", oneWay: true, stops: ["Chicago, IL", "Elkhart, IN", "Toledo, OH", "Cleveland, OH", "Conway Yard, PA", "Altoona, PA", "Harrisburg, PA", "Abrams, PA", "Philadelphia, PA"] },
  { id: "atlanta-croxton", name: "Atlanta ↔ Croxton (North Jersey)", forwardSymbol: "24X", reverseSymbol: "25A", stops: ["Atlanta, GA", "Charlotte, NC", "Greensboro, NC", "Roanoke, VA", "Harrisburg, PA", "Bethlehem, PA", "Croxton, NJ"] },
  { id: "chicago-croxton", name: "Chicago 47th ↔ Croxton", forwardSymbol: "20X", reverseSymbol: "23G / 29G", stops: ["Chicago 47th, IL", "Fort Wayne, IN", "Toledo, OH", "Cleveland, OH", "Conway Yard, PA", "Harrisburg, PA", "Bethlehem, PA", "Croxton, NJ"] },
  { id: "chicago-harrisburg", name: "Chicago 47th ↔ Harrisburg", forwardSymbol: "22X", reverseSymbol: "23G / 25G / 27G", stops: ["Chicago 47th, IL", "Fort Wayne, IN", "Toledo, OH", "Cleveland, OH", "Conway Yard, PA", "Harrisburg, PA"] },
  { id: "chicago-jacksonville", name: "Chicago Calumet ↔ Jacksonville", forwardSymbol: "29F", reverseSymbol: "26C", stops: ["Chicago Calumet, IL", "Fort Wayne, IN", "Cincinnati, OH", "Knoxville, TN", "Chattanooga, TN", "Atlanta, GA", "Macon, GA", "Jacksonville, FL"] },
  { id: "austell-chicago", name: "Austell (Atlanta) ↔ Chicago Calumet", forwardSymbol: "28C", reverseSymbol: "29A / 29F-G93", stops: ["Austell, GA", "Chattanooga, TN", "Knoxville, TN", "Cincinnati, OH", "Fort Wayne, IN", "Chicago Calumet, IL"] },
  { id: "bethlehem-rossville", name: "Bethlehem ↔ Rossville (Memphis)", forwardSymbol: "289", reverseSymbol: "288", stops: ["Bethlehem, PA", "Harrisburg, PA", "Roanoke, VA", "Knoxville, TN", "Chattanooga, TN", "Birmingham, AL", "Rossville, TN"] },
  { id: "chicago-norfolk", name: "Chicago Landers ↔ Norfolk", forwardSymbol: "276 / NV01", reverseSymbol: "NV24 / 277", stops: ["Chicago Landers, IL", "Fort Wayne, IN", "Columbus, OH", "Roanoke, VA", "Norfolk, VA"] },
  { id: "savannah-chicago", name: "Savannah ↔ Chicago Landers", forwardSymbol: "291 / 28C / BH44", reverseSymbol: "268 / 29A / 290", stops: ["Savannah, GA", "Macon, GA", "Austell, GA", "Chattanooga, TN", "Knoxville, TN", "Cincinnati, OH", "Fort Wayne, IN", "Chicago Landers, IL"] },
  { id: "atlanta-jacksonville", name: "Atlanta ↔ Jacksonville", forwardSymbol: "29F", reverseSymbol: "24A", stops: ["Atlanta, GA", "Macon, GA", "Jacksonville, FL"] },
];

export const routePresetChoices: RoutePresetChoice[] = routePresets.flatMap((preset) => {
  const first = preset.stops[0];
  const last = preset.stops.at(-1)!;
  const choices = [{ id: `${preset.id}:forward`, label: `${preset.name} — ${first} → ${last} · ${preset.forwardSymbol}` }];
  if (!preset.oneWay) choices.push({ id: `${preset.id}:reverse`, label: `${preset.name} — ${last} → ${first} · ${preset.reverseSymbol}` });
  return choices;
});

export function applyRoutePreset(route: RouteSchemaV2, choiceId: string): RouteSchemaV2 {
  const [presetId, direction] = choiceId.split(":");
  const preset = routePresets.find((item) => item.id === presetId);
  if (!preset || (direction !== "forward" && direction !== "reverse") || (preset.oneWay && direction === "reverse")) {
    throw new Error("Route preset not found.");
  }
  const names = direction === "reverse" ? [...preset.stops].reverse() : preset.stops;
  const stops: ShipmentStop[] = names.map((name, index) => {
    const location = locations[name];
    return makeStop(index, {
      name,
      coords: location.coords,
      type: index === 0 ? "Origin" : index === names.length - 1 ? "Destination" : (location.type || "Waypoint"),
      major: Boolean(location.major),
    });
  });
  return {
    ...route,
    trainId: direction === "reverse" ? preset.reverseSymbol : preset.forwardSymbol,
    currentPosition: { mode: "stop", stopId: stops[0].id },
    routeSegments: {},
    stops,
  };
}
