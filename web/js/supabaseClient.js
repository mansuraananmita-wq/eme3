import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";

/** @type {import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm").SupabaseClient | null} */
let client = null;

/**
 * True after the placeholders in config.js have been replaced.
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  return (
    typeof SUPABASE_URL === "string" &&
    typeof SUPABASE_ANON_KEY === "string" &&
    SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("YOUR_SUPABASE") &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE")
  );
}

/**
 * Reads the role claim from a JWT anon key. Publishable keys have no payload.
 * @param {string} key
 * @returns {string}
 */
function readKeyRole(key) {
  const payload = key.split(".")[1];
  if (!payload) return "";

  try {
    const normalized = payload.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const claims = JSON.parse(atob(padded));
    return typeof claims.role === "string" ? claims.role : "";
  } catch {
    return "";
  }
}

/**
 * Shared browser client. Uses the anon key only. RLS is the security boundary.
 * @returns {import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm").SupabaseClient}
 */
export function getSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error("Add your Supabase project URL and anon key in web/js/config.js.");
  }

  if (
    SUPABASE_ANON_KEY.includes("service_role") ||
    readKeyRole(SUPABASE_ANON_KEY) === "service_role"
  ) {
    throw new Error("The service_role key cannot be used in the browser.");
  }

  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return client;
}
