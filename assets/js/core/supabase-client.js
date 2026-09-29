import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js';

/** @type {object | null} */
let client = null;

/**
 * True when config.js has a real project URL and a non-secret key.
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  return (
    typeof SUPABASE_URL === 'string' &&
    typeof SUPABASE_ANON_KEY === 'string' &&
    SUPABASE_URL.startsWith('https://') &&
    !SUPABASE_URL.includes('YOUR_SUPABASE') &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE')
  );
}

/**
 * Reads the JWT role claim. Returns an empty string when the key is not a JWT.
 * @param {string} key
 * @returns {string}
 */
function readKeyRole(key) {
  const payload = key.split('.')[1];
  if (!payload) return '';

  try {
    const normalized = payload.replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const claims = JSON.parse(atob(padded));
    return typeof claims.role === 'string' ? claims.role : '';
  } catch {
    return '';
  }
}

/**
 * Shared browser client. Loads `@supabase/supabase-js` v2 from esm.sh on first use.
 * Row Level Security is the security boundary. This client can only use the anon key.
 * @returns {Promise<object>}
 */
export async function getSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in assets/js/core/config.js.',
    );
  }

  const role = readKeyRole(SUPABASE_ANON_KEY);
  if (role === 'service_role') {
    throw new Error('Refusing to start. The service_role key must never be used in frontend code.');
  }

  if (!client) {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
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
