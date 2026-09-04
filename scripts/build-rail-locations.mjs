import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error("Pass the extracted 2025_Gaz_place_national.txt path.");
}

const networkPath = resolve("public/data/ns-network.json");
const outputPath = resolve("public/data/rail-locations.json");
const MAX_DISTANCE_MILES = 25;
const CELL_SIZE = 1;

const cleanPlaceName = (name) => name
  .replace(/\s+\(balance\)$/i, "")
  .replace(/\s+(city and borough|consolidated government|metropolitan government|unified government|municipality|city|town|village|borough|CDP)$/i, "")
  .trim();

function distanceMiles([lat1, lon1], [lat2, lon2]) {
  const radians = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * radians / 2) ** 2
    + Math.cos(lat1 * radians) * Math.cos(lat2 * radians)
    * Math.sin((lon2 - lon1) * radians / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cellKey(lat, lon) {
  return `${Math.floor(lat / CELL_SIZE)},${Math.floor(lon / CELL_SIZE)}`;
}

function nearestRailPoint(index, point) {
  const [lat, lon] = point;
  let best = null;
  for (let latOffset = -1; latOffset <= 1; latOffset += 1) {
    for (let lonOffset = -1; lonOffset <= 1; lonOffset += 1) {
      const points = index.get(cellKey(lat + latOffset * CELL_SIZE, lon + lonOffset * CELL_SIZE)) || [];
      for (const candidate of points) {
        const miles = distanceMiles(point, candidate);
        if (!best || miles < best.miles) best = { coords: candidate, miles };
      }
    }
  }
  return best;
}

const edges = JSON.parse(await readFile(networkPath, "utf8"));
const railIndex = new Map();
const seenPoints = new Set();
for (const [, , geometry] of edges) {
  for (const coords of geometry) {
    const signature = `${coords[0]},${coords[1]}`;
    if (seenPoints.has(signature)) continue;
    seenPoints.add(signature);
    const key = cellKey(coords[0], coords[1]);
    railIndex.set(key, [...(railIndex.get(key) || []), coords]);
  }
}

const rows = (await readFile(resolve(sourcePath), "utf8")).trim().split(/\r?\n/);
const headers = rows.shift().split("|").map((header) => header.trim());
const column = Object.fromEntries(headers.map((header, index) => [header, index]));
const byPlace = new Map();

for (const row of rows) {
  const fields = row.split("|").map((field) => field.trim());
  const state = fields[column.USPS];
  const city = cleanPlaceName(fields[column.NAME]);
  const sourceCoords = [Number(fields[column.INTPTLAT]), Number(fields[column.INTPTLONG])];
  if (!city || !state || !sourceCoords.every(Number.isFinite)) continue;
  const nearest = nearestRailPoint(railIndex, sourceCoords);
  if (!nearest || nearest.miles > MAX_DISTANCE_MILES) continue;
  const item = {
    id: fields[column.GEOID],
    city,
    state,
    name: `${city}, ${state}`,
    coords: nearest.coords.map((value) => Number(value.toFixed(5))),
    railDistanceMiles: Number(nearest.miles.toFixed(1)),
  };
  const key = `${city.toLocaleLowerCase()}|${state}`;
  const existing = byPlace.get(key);
  if (!existing || item.railDistanceMiles < existing.railDistanceMiles) byPlace.set(key, item);
}

const locations = [...byPlace.values()].sort((a, b) => a.city.localeCompare(b.city) || a.state.localeCompare(b.state));
await writeFile(outputPath, `${JSON.stringify(locations)}\n`);
console.log(`Wrote ${locations.length.toLocaleString()} rail-adjacent U.S. places to ${outputPath}.`);
