import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { RailEdge, RouteSchemaV2, ShareLinkRecord, ShipmentRecord, ShipmentStatus, ShipmentStop } from "../types";
import {
  createShipment,
  getActiveShareLink,
  getShipment,
  manageShareLink,
  publishShipment,
  saveShipmentDraft,
} from "../lib/repository";
import { autoRoute, createBlankRoute, downloadRoute, localDateTime, makeStop, shiftDownstreamSchedules, unroutedLegs, validateRoute } from "../lib/route";
import { loadRailNetwork } from "../lib/railData";
import { Notice } from "../components/Notice";
import { ShipmentView } from "../components/ShipmentView";
import { StopEditor } from "../components/StopEditor";

type EditorTab = "quick" | "setup" | "preview" | "sharing";

export function ShipmentEditorPage() {
  const { id = "new" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const initial = (location.state as { route?: RouteSchemaV2 } | null)?.route;
  const [record, setRecord] = useState<ShipmentRecord | null>(null);
  const [route, setRoute] = useState<RouteSchemaV2>(initial || createBlankRoute());
  const [savedRoute, setSavedRoute] = useState<RouteSchemaV2 | null>(initial || null);
  const [status, setStatus] = useState<ShipmentStatus>("active");
  const [tab, setTab] = useState<EditorTab>("quick");
  const [loading, setLoading] = useState(id !== "new");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [railNetwork, setRailNetwork] = useState<RailEdge[] | null>(null);
  const [shareLink, setShareLink] = useState<ShareLinkRecord | null>(null);
  const [newShareUrl, setNewShareUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const dirty = useMemo(() => !savedRoute || JSON.stringify(route) !== JSON.stringify(savedRoute), [route, savedRoute]);
  const validation = useMemo(() => validateRoute(route), [route]);

  async function load() {
    if (id === "new") return;
    setLoading(true); setError(""); setConflict(false);
    try {
      const loaded = await getShipment(id);
      setRecord(loaded); setRoute(loaded.draft_data); setSavedRoute(structuredClone(loaded.draft_data)); setStatus(loaded.status);
      const link = await getActiveShareLink(id); setShareLink(link); setExpiresAt(link?.expires_at?.slice(0, 16) || "");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The shipment could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [id]);
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);

  function update<K extends keyof RouteSchemaV2>(key: K, value: RouteSchemaV2[K]) {
    setRoute((current) => ({ ...current, [key]: value }));
    setMessage("");
  }

  async function save(): Promise<ShipmentRecord | null> {
    setError(""); setMessage(""); setConflict(false);
    if (validation.length) { setError(validation.join(" ")); return null; }
    setWorking(true);
    try {
      const edges = railNetwork || await loadRailNetwork();
      const routed = autoRoute(route, edges);
      const missing = unroutedLegs(routed);
      setRailNetwork(edges); setRoute(routed);
      if (missing.length) {
        setError(`Could not follow the embedded NS track for: ${missing.join(", ")}. Check the stop coordinates and try again.`);
        return null;
      }
      const next = { ...routed, updatedAt: routed.updatedAt || localDateTime() };
      const saved = record
        ? await saveShipmentDraft(record.id, record.revision, next, status)
        : await createShipment(next);
      setRecord(saved); setRoute(saved.draft_data); setSavedRoute(structuredClone(saved.draft_data)); setMessage("Draft saved to the shared workspace.");
      if (!record) navigate(`/shipments/${saved.id}`, { replace: true });
      return saved;
    } catch (caught) {
      if (caught instanceof Error && caught.message === "REVISION_CONFLICT") {
        setConflict(true); setError("Another staff member saved a newer version. Reload before saving again, or export your current draft.");
      } else setError(caught instanceof Error ? caught.message : "The draft could not be saved. Export JSON to keep a local copy.");
      return null;
    } finally { setWorking(false); }
  }

  async function publish() {
    const saved = dirty || !record ? await save() : record;
    if (!saved) return;
    setWorking(true); setError("");
    try {
      const result = await publishShipment(saved.id, saved.revision);
      setRecord({ ...saved, last_published_at: result.publishedAt });
      setMessage(`Customer update published as version ${result.version}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The update could not be published."); }
    finally { setWorking(false); }
  }

  function updateStop(index: number, stop: ShipmentStop) {
    const previous = route.stops[index];
    const geometryChanged = previous.id !== stop.id || previous.coords[0] !== stop.coords[0] || previous.coords[1] !== stop.coords[1];
    let stops = [...route.stops]; stops[index] = stop;
    if (index === 0 && previous.scheduledAt !== stop.scheduledAt) {
      stops = shiftDownstreamSchedules(stops, previous.scheduledAt, stop.scheduledAt);
    }
    setRoute({ ...route, stops, routeSegments: geometryChanged ? {} : route.routeSegments });
    setMessage("");
  }

  function addStop() {
    update("stops", [...route.stops, makeStop(route.stops.length, {
      name: "",
      type: "Destination",
      coords: [Number.NaN, Number.NaN],
    })]);
  }

  function removeStop(index: number) {
    const stops = route.stops.filter((_, stopIndex) => stopIndex !== index);
    const position = route.currentPosition;
    const current = position.mode === "stop" && !stops.some((stop) => stop.id === position.stopId)
      ? { mode: "stop" as const, stopId: stops[0]?.id || "" }
      : position;
    setRoute({ ...route, stops, currentPosition: current, routeSegments: {} });
  }

  function changeCurrentLeg(fromStopId: string) {
    const index = route.stops.findIndex((stop) => stop.id === fromStopId);
    if (index < 0 || !route.stops[index + 1]) return;
    const progress = route.currentPosition.mode === "leg" ? route.currentPosition.progress : 0.5;
    update("currentPosition", { mode: "leg", fromStopId, toStopId: route.stops[index + 1].id, progress });
  }

  function changeCurrentProgress(progress: number) {
    const position = route.currentPosition;
    if (position.mode === "leg") update("currentPosition", { ...position, progress });
  }

  async function runAutoRoute() {
    setWorking(true); setError("");
    try {
      const edges = railNetwork || await loadRailNetwork();
      const routed = autoRoute(route, edges);
      const missing = unroutedLegs(routed);
      setRailNetwork(edges); setRoute(routed);
      if (missing.length) setError(`Could not follow the embedded NS track for: ${missing.join(", ")}. Check the stop coordinates and try again.`);
      else setMessage("Every route leg was recalculated from the embedded NS network.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The rail network could not be loaded."); }
    finally { setWorking(false); }
  }

  async function createLink() {
    if (!record?.last_published_at) { setError("Publish a customer update before creating a link."); return; }
    setWorking(true); setError(""); setNewShareUrl("");
    try {
      const result = await manageShareLink({ action: "create", shipmentId: record.id, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined });
      if (!result.token) throw new Error("A share token was not returned.");
      const url = `${window.location.origin}${window.location.pathname}#/track/${result.token}`;
      setNewShareUrl(url); setShareLink(result.link || null); await navigator.clipboard?.writeText(url); setMessage("New customer link created and copied. It is shown only once.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The share link could not be created."); }
    finally { setWorking(false); }
  }

  async function revokeLink() {
    if (!record || !shareLink) return;
    setWorking(true); setError("");
    try { await manageShareLink({ action: "revoke", shipmentId: record.id, linkId: shareLink.id }); setShareLink(null); setNewShareUrl(""); setMessage("Customer link revoked."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The link could not be revoked."); }
    finally { setWorking(false); }
  }

  async function updateExpiration() {
    if (!record || !shareLink) return;
    setWorking(true); setError("");
    try { const result = await manageShareLink({ action: "update-expiration", shipmentId: record.id, linkId: shareLink.id, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null }); setShareLink(result.link || shareLink); setMessage("Link expiration updated."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Expiration could not be updated."); }
    finally { setWorking(false); }
  }

  if (loading) return <div className="empty-state">Loading shipment…</div>;

  return (
    <>
      <section className="editor-heading">
        <div><button className="back-link" onClick={() => { if (!dirty || window.confirm("Leave without saving your draft?")) navigate("/shipments"); }}>← Shipments</button><h1>{route.trainId || "New shipment"}</h1><p className="muted">{route.customer || "Complete the required details to save."}</p></div>
        <div className="toolbar"><span className={dirty ? "draft-indicator dirty" : "draft-indicator"}>{dirty ? "Unsaved changes" : "Draft saved"}</span><button className="button" onClick={() => downloadRoute(route)}>Export JSON</button><button className="button" disabled={working || !dirty} onClick={() => void save()}>{working ? "Working…" : "Save draft"}</button><button className="button primary" disabled={working || validation.length > 0} onClick={() => void publish()}>Publish customer update</button></div>
      </section>
      {message && <Notice tone="success">{message}</Notice>}
      {error && <Notice tone="error">{error} {conflict && <><button className="text-button" onClick={() => void load()}>Reload latest</button><button className="text-button" onClick={() => downloadRoute(route)}>Export my draft</button></>}</Notice>}
      <nav className="editor-tabs">
        {(["quick", "setup", "preview", "sharing"] as EditorTab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item === "quick" ? "Quick update" : item === "setup" ? "Route setup" : item[0].toUpperCase() + item.slice(1)}</button>)}
      </nav>
      {tab === "quick" && <section className="panel editor-panel"><div className="section-heading"><div><p className="eyebrow">Customer and movement</p><h2>Quick update</h2></div><label className="compact-field">Status<select value={status} onChange={(event) => setStatus(event.target.value as ShipmentStatus)}><option value="active">Active</option><option value="delivered">Delivered</option>{status === "archived" && <option value="archived">Archived</option>}</select></label></div><div className="form-grid three"><label>Train / shipment ID<input value={route.trainId} onChange={(event) => update("trainId", event.target.value)} /></label><label>Customer<input value={route.customer} onChange={(event) => update("customer", event.target.value)} /></label><label>Commodity<input value={route.commodity} onChange={(event) => update("commodity", event.target.value)} /></label><label>Cars<input type="number" min="0" max="9999" value={route.cars} onChange={(event) => update("cars", Number(event.target.value))} /></label><label>Last updated<input type="datetime-local" value={route.updatedAt} onChange={(event) => update("updatedAt", event.target.value)} /></label><label>Timezone<input maxLength={12} value={route.timezone} onChange={(event) => update("timezone", event.target.value)} /></label></div><section className="subpanel"><h3>Current position</h3><div className="position-controls"><select value={route.currentPosition.mode} onChange={(event) => update("currentPosition", event.target.value === "stop" ? { mode: "stop", stopId: route.stops[0]?.id || "" } : { mode: "leg", fromStopId: route.stops[0]?.id || "", toStopId: route.stops[1]?.id || "", progress: 0.5 })}><option value="stop">At a stop</option><option value="leg">Between stops</option></select>{route.currentPosition.mode === "stop" ? <select value={route.currentPosition.stopId} onChange={(event) => update("currentPosition", { mode: "stop", stopId: event.target.value })}>{route.stops.map((stop) => <option key={stop.id} value={stop.id}>{stop.name}</option>)}</select> : <><select value={route.currentPosition.fromStopId} onChange={(event) => changeCurrentLeg(event.target.value)}>{route.stops.slice(0, -1).map((stop, index) => <option key={stop.id} value={stop.id}>{stop.name} → {route.stops[index + 1].name}</option>)}</select><label className="range-label">Progress <input type="range" min="0" max="100" value={Math.round(route.currentPosition.progress * 100)} onChange={(event) => changeCurrentProgress(Number(event.target.value) / 100)} /><strong>{Math.round(route.currentPosition.progress * 100)}%</strong></label></>}</div></section></section>}
      {tab === "setup" && <section className="editor-stack"><section className="panel section-heading"><div><p className="eyebrow">Stops and geometry</p><h2>Route setup</h2><p className="muted">Type a city and select it to fill the nearest NS rail coordinates automatically. Then auto-route the legs.</p></div><div className="toolbar"><button className="button" disabled={working} onClick={() => void runAutoRoute()}>Auto-route legs</button><button className="button primary" onClick={addStop}>+ Add stop</button></div></section>{route.stops.map((stop, index) => <StopEditor key={stop.id} stop={stop} index={index} total={route.stops.length} onChange={(next) => updateStop(index, next)} onRemove={() => removeStop(index)} />)}<div className="route-setup-footer"><button className="button primary" onClick={addStop}>+ Add stop</button></div></section>}
      {tab === "preview" && <ShipmentView route={route} publishedAt={record?.last_published_at || undefined} />}
      {tab === "sharing" && <section className="settings-grid"><section className="panel"><p className="eyebrow">Published customer view</p><h2>Share link</h2><p className="muted">The link always shows the latest published snapshot. Draft edits and internal notes are never included.</p>{!record?.last_published_at ? <Notice>Publish the shipment before creating a customer link.</Notice> : shareLink ? <><Notice tone="success">An active customer link exists{shareLink.expires_at ? ` and expires ${new Date(shareLink.expires_at).toLocaleString()}` : " without an expiration"}.</Notice><label>Expiration<input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label><div className="toolbar"><button className="button" onClick={() => void updateExpiration()}>Update expiration</button><button className="button danger" onClick={() => void revokeLink()}>Revoke link</button><button className="button primary" onClick={() => void createLink()}>Regenerate link</button></div></> : <><label>Expiration<input type="datetime-local" value={expiresAt || defaultExpiration()} onChange={(event) => setExpiresAt(event.target.value)} /></label><button className="button primary" onClick={() => void createLink()}>Create and copy customer link</button></>}{newShareUrl && <div className="one-time-link"><strong>Copy this link now</strong><input readOnly value={newShareUrl} onFocus={(event) => event.target.select()} /><button className="button" onClick={() => void navigator.clipboard.writeText(newShareUrl)}>Copy</button><small>For security, the complete link will not be shown again. Regenerate it if it is lost.</small></div>}</section><section className="panel"><p className="eyebrow">Publication status</p><h2>{record?.last_published_at ? "Customer view is live" : "Draft only"}</h2><p>{record?.last_published_at ? `Last published ${new Date(record.last_published_at).toLocaleString()}.` : "No customer-safe snapshot has been published."}</p><p className="muted">Saving a draft does not change what customers see.</p></section></section>}
    </>
  );
}

function defaultExpiration() {
  const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
