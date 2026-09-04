import type { Coordinates } from "../types";

export interface RailLocation {
  id: string;
  city: string;
  state: string;
  name: string;
  coords: Coordinates;
  railDistanceMiles: number;
}

let locationsPromise: Promise<RailLocation[]> | null = null;

function normalize(value: string): string {
  return value.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function loadRailLocations(): Promise<RailLocation[]> {
  locationsPromise ||= fetch(`${import.meta.env.BASE_URL}data/rail-locations.json`).then((response) => {
    if (!response.ok) throw new Error("Could not load the rail location directory.");
    return response.json() as Promise<RailLocation[]>;
  });
  return locationsPromise;
}

export function searchRailLocations(locations: RailLocation[], query: string, limit = 8): RailLocation[] {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 2) return [];
  const tokens = normalizedQuery.split(" ");

  return locations
    .map((location) => {
      const city = normalize(location.city);
      const name = normalize(location.name);
      const searchable = `${city} ${location.state.toLocaleLowerCase()}`;
      if (!tokens.every((token) => searchable.includes(token))) return null;
      const score = name === normalizedQuery ? 0
        : city === normalizedQuery ? 1
          : name.startsWith(normalizedQuery) ? 2
            : city.startsWith(normalizedQuery) ? 3
              : name.includes(normalizedQuery) ? 4
                : 5;
      return { location, score };
    })
    .filter((item): item is { location: RailLocation; score: number } => item !== null)
    .sort((a, b) => a.score - b.score
      || a.location.railDistanceMiles - b.location.railDistanceMiles
      || a.location.name.localeCompare(b.location.name))
    .slice(0, limit)
    .map(({ location }) => location);
}
