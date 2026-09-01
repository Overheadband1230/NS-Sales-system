import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(url && publishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, publishableKey, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured. Add the VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY settings.");
  return supabase;
}

export function functionError(error: unknown, fallback: string): Error {
  if (error && typeof error === "object") {
    const context = (error as { context?: Response }).context;
    if (context instanceof Response) return new Error(`${fallback} (${context.status})`);
    if ("message" in error) return new Error(String((error as { message: unknown }).message));
  }
  return new Error(fallback);
}
