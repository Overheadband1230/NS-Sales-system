import type { ShipmentStop } from "../types";

export function StopEditor({ stop, index, total, onChange, onRemove }: {
  stop: ShipmentStop;
  index: number;
  total: number;
  onChange: (stop: ShipmentStop) => void;
  onRemove: () => void;
}) {
  const set = <K extends keyof ShipmentStop>(key: K, value: ShipmentStop[K]) => onChange({ ...stop, [key]: value });
  return (
    <article className="stop-editor">
      <header><div className="stop-number">{index + 1}</div><div><strong>{stop.name || `Stop ${index + 1}`}</strong><small>{stop.type}</small></div>{total > 2 && <button className="text-button danger-text" onClick={onRemove}>Remove</button>}</header>
      <div className="form-grid three">
        <label>Name<input value={stop.name} onChange={(event) => set("name", event.target.value)} /></label>
        <label>Type<select value={stop.type} onChange={(event) => set("type", event.target.value)}><option>Origin</option><option>Waypoint</option><option>Interchange Hub</option><option>Classification Yard</option><option>Destination</option></select></label>
        <label className="checkbox-label"><input type="checkbox" checked={stop.major} onChange={(event) => set("major", event.target.checked)} /> Major stop</label>
        <label>Latitude<input type="number" step="0.00001" min="-90" max="90" value={Number.isFinite(stop.coords[0]) ? stop.coords[0] : ""} onChange={(event) => set("coords", [Number(event.target.value), stop.coords[1]])} /></label>
        <label>Longitude<input type="number" step="0.00001" min="-180" max="180" value={Number.isFinite(stop.coords[1]) ? stop.coords[1] : ""} onChange={(event) => set("coords", [stop.coords[0], Number(event.target.value)])} /></label>
        <label>Timing state<select value={stop.timingState} onChange={(event) => set("timingState", event.target.value as ShipmentStop["timingState"])}><option value="none">Not set</option><option value="estimated">Estimated</option><option value="actual">Actual</option></select></label>
        <label>Scheduled<input type="datetime-local" value={stop.scheduledAt} onChange={(event) => set("scheduledAt", event.target.value)} /></label>
        <label>Projected / actual<input type="datetime-local" value={stop.projectedAt} onChange={(event) => set("projectedAt", event.target.value)} /></label>
      </div>
      <div className="form-grid two notes-grid">
        <label>Customer-visible note<textarea rows={3} value={stop.customerNote} maxLength={2000} onChange={(event) => set("customerNote", event.target.value)} /></label>
        <label>Internal note <span className="private-label">staff only</span><textarea rows={3} value={stop.internalNote} maxLength={2000} onChange={(event) => set("internalNote", event.target.value)} /></label>
      </div>
    </article>
  );
}
