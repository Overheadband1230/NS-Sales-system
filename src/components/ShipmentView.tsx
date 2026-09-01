import type { RouteSchemaV2 } from "../types";
import { currentPositionLabel, routeMiles } from "../lib/route";
import { ShipmentMap } from "./ShipmentMap";

function formatDate(value: string, timezone: string) {
  if (!value) return "Not set";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : `${parsed.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} ${timezone}`;
}

export function ShipmentView({ route, publishedAt }: { route: RouteSchemaV2; publishedAt?: string }) {
  const miles = Math.round(routeMiles(route));
  return (
    <div className="tracker-view">
      <section className="tracker-hero">
        <div>
          <p className="eyebrow">{route.carrier}</p>
          <h1>{route.stops[0]?.name || "Origin"} <span>→</span> {route.stops.at(-1)?.name || "Destination"}</h1>
          <p className="muted">Shipment {route.trainId} · {route.customer}</p>
        </div>
        <div className="snapshot-pill">
          <span className="status-dot" />
          <div><strong>Published snapshot</strong><small>{publishedAt ? new Date(publishedAt).toLocaleString() : formatDate(route.updatedAt, route.timezone)}</small></div>
        </div>
      </section>
      <div className="tracker-grid">
        <section className="map-card"><ShipmentMap route={route} /></section>
        <aside className="route-panel">
          <section className="position-card">
            <p className="eyebrow">Current position</p>
            <h2>{currentPositionLabel(route)}</h2>
            <p className="muted">Last updated {formatDate(route.updatedAt, route.timezone)}</p>
          </section>
          <div className="metric-grid">
            <div><strong>{miles.toLocaleString()}</strong><span>planned miles</span></div>
            <div><strong>{route.cars}</strong><span>cars</span></div>
            <div><strong>{route.stops.length}</strong><span>stops</span></div>
            <div><strong>{route.commodity || "—"}</strong><span>commodity</span></div>
          </div>
          <div className="timeline">
            {route.stops.map((stop, index) => (
              <article className="timeline-item" key={stop.id}>
                <div className="timeline-marker">{index + 1}</div>
                <div>
                  <div className="timeline-title"><strong>{stop.name}</strong><span>{stop.type}</span></div>
                  <p>{stop.projectedAt ? `${stop.timingState === "actual" ? "Actual" : "Projected"}: ${formatDate(stop.projectedAt, route.timezone)}` : "Timing not set"}</p>
                  {stop.customerNote && <p className="customer-note">{stop.customerNote}</p>}
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
