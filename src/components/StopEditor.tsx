import { useMemo, useState } from "react";
import { loadRailLocations, searchRailLocations, type RailLocation } from "../lib/railLocations";
import type { ShipmentStop } from "../types";

export function StopEditor({ stop, index, total, onChange, onRemove, onMoveUp, onMoveDown }: {
  stop: ShipmentStop;
  index: number;
  total: number;
  onChange: (stop: ShipmentStop) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [locations, setLocations] = useState<RailLocation[]>([]);
  const [directoryState, setDirectoryState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const suggestions = useMemo(() => searchRailLocations(locations, stop.name), [locations, stop.name]);
  const inputId = `stop-location-${stop.id}`;
  const listId = `${inputId}-list`;
  const set = <K extends keyof ShipmentStop>(key: K, value: ShipmentStop[K]) => onChange({ ...stop, [key]: value });

  async function ensureDirectory() {
    if (directoryState === "loading" || directoryState === "ready") return;
    setDirectoryState("loading");
    try {
      setLocations(await loadRailLocations());
      setDirectoryState("ready");
    } catch {
      setDirectoryState("error");
    }
  }

  function chooseLocation(location: RailLocation) {
    onChange({ ...stop, name: location.name, coords: location.coords });
    setOpen(false);
  }

  function changeLocation(value: string) {
    onChange({ ...stop, name: value, coords: [Number.NaN, Number.NaN] });
    setActiveIndex(0);
    setOpen(true);
    void ensureDirectory();
  }

  return (
    <article className="stop-editor">
      <header>
        <div className="stop-number">{index + 1}</div>
        <div><strong>{stop.name || `Stop ${index + 1}`}</strong><small>{stop.type}</small></div>
        <div className="stop-actions">
          <button type="button" className="move-stop" aria-label={`Move ${stop.name || `stop ${index + 1}`} up`} disabled={index === 0} onClick={onMoveUp}>↑</button>
          <button type="button" className="move-stop" aria-label={`Move ${stop.name || `stop ${index + 1}`} down`} disabled={index === total - 1} onClick={onMoveDown}>↓</button>
          {total > 2 && <button type="button" className="text-button danger-text" onClick={onRemove}>Remove</button>}
        </div>
      </header>
      <div className="form-grid three">
        <div className="location-field">
          <label htmlFor={inputId}>City or rail location</label>
          <div className="location-combobox">
            <input
              id={inputId}
              value={stop.name}
              placeholder="Start typing a city, such as Atlanta"
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open && (directoryState === "loading" || suggestions.length > 0)}
              aria-controls={listId}
              aria-activedescendant={open && suggestions[activeIndex] ? `${listId}-${suggestions[activeIndex].id}` : undefined}
              onFocus={() => { setOpen(true); void ensureDirectory(); }}
              onBlur={() => setOpen(false)}
              onChange={(event) => changeLocation(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && suggestions.length) {
                  event.preventDefault();
                  setOpen(true);
                  setActiveIndex((current) => (current + 1) % suggestions.length);
                } else if (event.key === "ArrowUp" && suggestions.length) {
                  event.preventDefault();
                  setOpen(true);
                  setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
                } else if (event.key === "Enter" && open && suggestions[activeIndex]) {
                  event.preventDefault();
                  chooseLocation(suggestions[activeIndex]);
                } else if (event.key === "Escape") {
                  setOpen(false);
                }
              }}
            />
            {open && directoryState === "loading" && <div className="location-menu location-message">Loading rail locations…</div>}
            {open && directoryState === "ready" && stop.name.trim().length >= 2 && suggestions.length === 0 && <div className="location-menu location-message">No rail location found. Try another nearby city.</div>}
            {open && suggestions.length > 0 && (
              <div className="location-menu" id={listId} role="listbox">
                {suggestions.map((location, suggestionIndex) => (
                  <button
                    type="button"
                    id={`${listId}-${location.id}`}
                    role="option"
                    aria-selected={suggestionIndex === activeIndex}
                    className={suggestionIndex === activeIndex ? "active" : ""}
                    key={location.id}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseLocation(location)}
                  >
                    <strong>{location.city}, {location.state}</strong>
                    <small>{location.railDistanceMiles <= 0.1 ? "On the rail network" : `Rail access ${location.railDistanceMiles.toFixed(1)} mi from city center`}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          {directoryState === "error" && <small className="field-error">The rail location directory could not be loaded.</small>}
          {Number.isFinite(stop.coords[0]) && Number.isFinite(stop.coords[1]) && <small className="field-success">Rail coordinates filled automatically</small>}
        </div>
        <label>Type<select value={stop.type} onChange={(event) => set("type", event.target.value)}><option>Origin</option><option>Waypoint</option><option>Interchange Hub</option><option>Classification Yard</option><option>Destination</option></select></label>
        <label className="checkbox-label"><input type="checkbox" checked={stop.major} onChange={(event) => set("major", event.target.checked)} /> Major stop</label>
        <label>Timing state<select value={stop.timingState} onChange={(event) => set("timingState", event.target.value as ShipmentStop["timingState"])}><option value="none">Not set</option><option value="estimated">Estimated</option><option value="actual">Actual</option></select></label>
        <label>Scheduled<input type="datetime-local" value={stop.scheduledAt} onChange={(event) => set("scheduledAt", event.target.value)} /></label>
        <label>Projected / actual<input type="datetime-local" value={stop.projectedAt} onChange={(event) => set("projectedAt", event.target.value)} /></label>
      </div>
      <details className="advanced-location">
        <summary>Advanced coordinates</summary>
        <div className="form-grid two">
          <label>Latitude<input type="number" step="0.00001" min="-90" max="90" value={Number.isFinite(stop.coords[0]) ? stop.coords[0] : ""} onChange={(event) => set("coords", [Number(event.target.value), stop.coords[1]])} /></label>
          <label>Longitude<input type="number" step="0.00001" min="-180" max="180" value={Number.isFinite(stop.coords[1]) ? stop.coords[1] : ""} onChange={(event) => set("coords", [stop.coords[0], Number(event.target.value)])} /></label>
        </div>
      </details>
      <div className="form-grid two notes-grid">
        <label>Customer-visible note<textarea rows={3} value={stop.customerNote} maxLength={2000} onChange={(event) => set("customerNote", event.target.value)} /></label>
        <label>Internal note <span className="private-label">staff only</span><textarea rows={3} value={stop.internalNote} maxLength={2000} onChange={(event) => set("internalNote", event.target.value)} /></label>
      </div>
    </article>
  );
}
