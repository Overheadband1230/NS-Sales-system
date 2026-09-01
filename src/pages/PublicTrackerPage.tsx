import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { PublicShipmentResponse } from "../types";
import { getPublicShipment } from "../lib/repository";
import { ShipmentView } from "../components/ShipmentView";

export function PublicTrackerPage() {
  const { shareToken = "" } = useParams();
  const [data, setData] = useState<PublicShipmentResponse | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    setUnavailable(false);
    void getPublicShipment(shareToken).then(setData).catch(() => setUnavailable(true));
  }, [shareToken]);
  if (unavailable) return <main className="public-state"><div className="brand-mark">NS</div><h1>Shipment link unavailable</h1><p>This link may be invalid, expired, or revoked. Contact your shipment representative for a new link.</p></main>;
  if (!data) return <main className="public-state"><div className="spinner" /><p>Loading shipment…</p></main>;
  return <main className="public-page"><ShipmentView route={data.shipment} publishedAt={data.publishedAt} /></main>;
}
