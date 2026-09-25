# Norfolk Southern Shipment Tracker

A single-file, offline route planner and shipment tracker. Everything — the map, U.S. state boundaries, the Norfolk Southern rail network, and the app itself — is embedded in one HTML file, so it runs in any modern browser with no internet connection and nothing to install.

The current version is **`NS_Sales_route_V2.7.html`**.

## Opening the tracker

- **Locally:** double-click `NS_Sales_route_V2.7.html` (Chrome or Edge recommended).
- **Online:** every push to `main` publishes the repository to GitHub Pages at
  `https://overheadband1230.github.io/NS-Sales-system/NS_Sales_route_V2.7.html`.

This file is the **working (editor) copy**. It includes the editing tools, internal notes, and presentation tools. The file you send to a customer is generated from it (see [Sending a customer update](#sending-a-customer-update)).

## The main screen

- **Map (left):** the planned route drawn on the NS network. Solid blue is completed track, dashed gray is track still ahead, and the yellow ◆ marker is the train.
  - Round markers are ordinary stops; diamond markers are major hubs and yards.
  - Blue = passed, yellow = current / next stop, gray = upcoming.
  - Hover a marker to see the stop name. Click a stop in the right-hand list to zoom to it.
  - **Fit route** re-centers the map on the whole route.
- **Details (right):** current position, progress, train/customer/cars, next stop, and the full route & schedule with scheduled and actual/estimated times.
- **Snapshot banner:** shows the "accurate as of" time. The tracker never updates on its own; the time only changes when you save an update.

## Updating a shipment

Click **✎ Update shipment** (top right). The editor has two tabs. Nothing changes on the map until you save.

### Quick update (day-to-day status)

1. Confirm the **Train ID / symbol**.
2. Choose the **Latest reached stop**. The next stop is picked automatically from the route order.
3. Enter the actual time at the current stop and the estimated arrival at the next stop, and add any **Customer-visible note** (shown to the customer) or **Internal note** (never included in customer files).
4. **Timezone:** use ET, CT, MT, or PT and the "Last updated" time is stamped automatically when you save & download. Typing a time yourself overrides this; **Use automatic time** turns automatic stamping back on.
5. Optional — **Advanced position** places the train partway between two stops using a percentage slider.

### Route setup (building or changing a route)

- **Shipment details:** carrier/title, train ID, customer, commodity, car count, last updated time, and timezone.
- **Common NS route presets:** pick a published corridor and direction, then **Load this route** to fill in all stops at once.
- **Stops & schedule:**
  - **+ Add stop**, then **Edit** it to set the name, coordinates, stop type, scheduled and actual/estimated times, and notes.
  - **Fill from saved location** fills in a known place (for example Chicago, IL, Conway Yard, PA, or Bellevue, OH) with its coordinates and type.
  - Tick **Major hub (diamond)** to show the stop as a diamond.
  - Reorder stops by dragging them or with the ↑ / ↓ buttons; **Remove** deletes a stop (a route needs at least two).
  - **⚡ Auto-route on NS network** snaps every leg to the embedded NS track. This also happens automatically when you save.
- **Current train position:** set where the train is, as on the Quick update tab.
- **Saved locations:** add your own named places with coordinates. These are stored in this browser only; use **Export locations** / **Import locations** to move them to another computer.

### Saving

- **Save only:** applies the changes and saves the working route in this browser.
- **Save & download customer update:** applies the changes, stamps the time, saves the working route, and downloads the customer file.
- **Cancel:** closes the editor without applying changes.

If a stop has bad coordinates or a leg can't follow NS track, the editor shows an error at the top of the Quick update tab instead of saving.

## Saved routes and moving between computers

Open **Route setup → Saved routes, customer download, and portable JSON**:

- **Saved routes:** reopen or delete routes stored in this browser.
- **↓ Export route JSON / ↑ Import route JSON:** a portable file with the full editable shipment, including internal notes. Use this to back up a route or continue work on another computer. Browser storage can be cleared, so export anything you need to keep.

## Sending a customer update

**Save & download customer update** (or **↓ Download customer HTML**) creates `shipment_<train>_<date>.html`. This is a read-only copy that:

- opens offline in any browser and can be emailed as an attachment;
- shows the map, route, schedule, and customer-visible notes;
- has **no** editor, internal notes, highlight controls, or PNG export.

## Presentation tools

These appear at the bottom-right of the map in the working copy only.

### Highlighting a location

1. Pick a stop from the **Highlight** list.
2. Click the color box and choose any color.

The stop keeps its normal size and shape but changes to your color, its name label stays visible on the map, and its dot in the route list changes to match. Each stop can have its own color. **Clear** returns the selected stop to its normal status color.

Highlights are saved with the route when you save in the editor, and they also appear in customer files downloaded afterwards. If you reload the page before saving, highlights set from the map are lost.

### Exporting a PNG for PowerPoint

1. Arrange the map the way you want it — zoom, pan, or press **Fit route** — and set any highlights.
2. Click **Export PNG**.

A high-resolution image (twice screen resolution) named `route-map_<train>_<date>.png` is downloaded. It contains the state map, NS network, route, stop markers, highlight labels, and the train marker, without the zoom buttons or on-map chips. The image is the same shape as the map on screen, so widen the browser window first for a wider, slide-friendly image.

## Data sources

- Map boundaries: U.S. Census Bureau 2025 cartographic boundary files.
- Rail network: U.S. DOT NTAD Norfolk Southern network data.
- Map engine: Leaflet 1.9.4 (BSD-2-Clause), embedded for offline use.
