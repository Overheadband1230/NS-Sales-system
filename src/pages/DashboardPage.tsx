import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { ShipmentStatus, ShipmentSummary } from "../types";
import { createShipment, listShipments, setShipmentStatus } from "../lib/repository";
import { createBlankRoute, migrateRoute, validateRoute } from "../lib/route";
import { Notice } from "../components/Notice";

export function DashboardPage() {
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ShipmentStatus>("active");
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  async function reload() {
    setLoading(true); setError("");
    try { setShipments(await listShipments()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Shipments could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void reload(); }, []);

  const filtered = useMemo(() => shipments.filter((shipment) => {
    const haystack = `${shipment.train_id} ${shipment.customer_name} ${shipment.origin_name} ${shipment.destination_name}`.toLowerCase();
    return shipment.status === status && haystack.includes(query.toLowerCase());
  }), [shipments, query, status]);

  async function newShipment() {
    navigate("/shipments/new", { state: { route: createBlankRoute() } });
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Route JSON must be smaller than 5 MB."); return; }
    try {
      const route = migrateRoute(JSON.parse(await file.text()));
      const errors = validateRoute(route);
      if (errors.length) throw new Error(errors.join(" "));
      const created = await createShipment(route);
      navigate(`/shipments/${created.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The route file is invalid."); }
  }

  async function archive(id: string) {
    if (!window.confirm("Archive this shipment and revoke its customer link?")) return;
    try { await setShipmentStatus(id, "archived"); await reload(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The shipment could not be archived."); }
  }

  return (
    <>
      <section className="page-heading">
        <div><p className="eyebrow">Shared workspace</p><h1>Shipments</h1><p className="muted">Draft privately, then publish a customer-safe update.</p></div>
        <div className="toolbar"><input ref={fileRef} hidden type="file" accept=".json,application/json" onChange={importFile} /><button className="button" onClick={() => fileRef.current?.click()}>Import JSON</button><button className="button primary" onClick={newShipment}>+ New shipment</button></div>
      </section>
      {error && <Notice tone="error">{error} <button className="text-button" onClick={() => void reload()}>Retry</button></Notice>}
      <section className="dashboard-controls">
        <input aria-label="Search shipments" placeholder="Search train, customer, or location" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="segmented" aria-label="Shipment status">
          {(["active", "delivered", "archived"] as ShipmentStatus[]).map((item) => <button key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
        </div>
      </section>
      <section className="table-card">
        {loading ? <div className="empty-state">Loading shipments…</div> : !filtered.length ? <div className="empty-state"><h2>No {status} shipments</h2><p>Create a shipment or import a Route Schema v2 JSON file.</p></div> : (
          <div className="shipment-list">
            {filtered.map((shipment) => (
              <article className="shipment-row" key={shipment.id}>
                <button className="shipment-main" onClick={() => navigate(`/shipments/${shipment.id}`)}>
                  <span className={`status-badge ${shipment.status}`}>{shipment.status}</span>
                  <span><strong>{shipment.train_id}</strong><small>{shipment.customer_name}</small></span>
                  <span className="route-copy"><strong>{shipment.origin_name} → {shipment.destination_name}</strong><small>Updated {new Date(shipment.updated_at).toLocaleString()}</small></span>
                  <span className={shipment.last_published_at ? "published" : "unpublished"}>{shipment.last_published_at ? "Published" : "Draft only"}</span>
                </button>
                {shipment.status !== "archived" && <button className="icon-action" aria-label={`Archive ${shipment.train_id}`} onClick={() => void archive(shipment.id)}>Archive</button>}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
