import { useEffect, useMemo, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Polyline, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import type { RailEdge, RouteSchemaV2 } from "../types";
import { currentCoordinates, routeLegGeometries } from "../lib/route";
import { loadRailNetwork, loadUsStates } from "../lib/railData";

function FitRoute({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 8 });
  }, [map, points]);
  return null;
}

export function ShipmentMap({ route, showNetwork = true }: { route: RouteSchemaV2; showNetwork?: boolean }) {
  const [states, setStates] = useState<GeoJSON.FeatureCollection | null>(null);
  const [network, setNetwork] = useState<RailEdge[]>([]);
  const legs = useMemo(() => routeLegGeometries(route), [route]);
  const points = useMemo(() => legs.flat(), [legs]);
  const current = useMemo(() => currentCoordinates(route), [route]);

  useEffect(() => {
    void loadUsStates().then(setStates).catch(() => setStates(null));
    if (showNetwork) void loadRailNetwork().then(setNetwork).catch(() => setNetwork([]));
  }, [showNetwork]);

  return (
    <MapContainer className="shipment-map" center={[39.5, -86]} zoom={5} zoomControl attributionControl={false}>
      {states && <GeoJSON data={states} style={{ color: "#536171", weight: 0.7, fillColor: "#111820", fillOpacity: 0.95 }} />}
      {network.map(([from, to, geometry]) => (
        <Polyline key={`${from}-${to}`} positions={geometry} pathOptions={{ color: "#f97316", weight: 1.5, opacity: 0.72 }} interactive={false} />
      ))}
      {legs.map((leg, index) => (
        <Polyline key={`${route.stops[index]?.id || index}-rail`} positions={leg} pathOptions={{ color: "#3b82f6", weight: 4, opacity: 1 }} />
      ))}
      {route.stops.map((stop, index) => (
        <CircleMarker
          key={stop.id}
          center={stop.coords}
          radius={stop.major ? 7 : 5}
          pathOptions={{ color: "#f2c94c", fillColor: index === 0 ? "#5bd6a2" : "#101820", fillOpacity: 1, weight: 2 }}
        >
          <Tooltip direction="top">{stop.name}</Tooltip>
          <Popup><strong>{stop.name}</strong><br />{stop.type}</Popup>
        </CircleMarker>
      ))}
      {current && (
        <CircleMarker center={current} radius={9} pathOptions={{ color: "white", fillColor: "#ff6b35", fillOpacity: 1, weight: 3 }}>
          <Tooltip permanent direction="top">Current</Tooltip>
        </CircleMarker>
      )}
      <FitRoute points={points} />
    </MapContainer>
  );
}
