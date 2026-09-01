const defaults = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "https://overheadband1230.github.io",
];

function allowedOrigins(): string[] {
  const configured = Deno.env.get("APP_ALLOWED_ORIGINS")?.split(",").map((value) => value.trim()).filter(Boolean) || [];
  return [...new Set([...defaults, ...configured])];
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins().includes(origin) ? origin : defaults[2],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function preflight(request: Request): Response | null {
  return request.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders(request) }) : null;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (request.method !== "POST") throw new Error("Method not allowed");
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 32_000) throw new Error("Request is too large");
  const value = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request");
  return value as Record<string, unknown>;
}

export function publicError(request: Request, status = 404): Response {
  return json(request, { ok: false, error: "Shipment link unavailable" }, status);
}
