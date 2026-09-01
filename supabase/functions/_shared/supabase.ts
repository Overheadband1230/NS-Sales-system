import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

function projectUrl(): string {
  const value = Deno.env.get("SUPABASE_URL");
  if (!value) throw new Error("SUPABASE_URL is unavailable");
  return value;
}

function publishableKey(): string {
  const direct = Deno.env.get("APP_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  if (direct) return direct;
  const keys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (keys) return JSON.parse(keys).default;
  throw new Error("A publishable key is unavailable");
}

function secretKey(): string {
  const direct = Deno.env.get("APP_SECRET_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) return JSON.parse(keys).default;
  throw new Error("A secret key is unavailable");
}

export function userClient(request: Request): SupabaseClient {
  return createClient(projectUrl(), publishableKey(), {
    global: { headers: { Authorization: request.headers.get("Authorization") || "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function adminClient(): SupabaseClient {
  return createClient(projectUrl(), secretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireActiveUser(request: Request): Promise<{ client: SupabaseClient; user: User; profile: { role: "admin" | "editor" } }> {
  const client = userClient(request);
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new Error("AUTH_REQUIRED");
  const { data: profile, error: profileError } = await client.from("profiles").select("role,active").eq("id", userData.user.id).single();
  if (profileError || !profile?.active) throw new Error("AUTH_REQUIRED");
  return { client, user: userData.user, profile };
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
