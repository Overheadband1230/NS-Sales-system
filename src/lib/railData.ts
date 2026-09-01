import type { RailEdge } from "../types";

let statesPromise: Promise<GeoJSON.FeatureCollection> | null = null;
let networkPromise: Promise<RailEdge[]> | null = null;

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${path}`);
  if (!response.ok) throw new Error(`Could not load ${path}.`);
  return response.json() as Promise<T>;
}

export function loadUsStates(): Promise<GeoJSON.FeatureCollection> {
  statesPromise ||= fetchJson<GeoJSON.FeatureCollection>("us-states.json");
  return statesPromise;
}

export function loadRailNetwork(): Promise<RailEdge[]> {
  networkPromise ||= fetchJson<RailEdge[]>("ns-network.json");
  return networkPromise;
}
