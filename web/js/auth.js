import { getSupabase } from "./supabaseClient.js";
import { safeNext, url } from "./paths.js";

/** @typedef {'admin' | 'vendor' | 'customer'} UserRole */

/**
 * @typedef {object} Profile
 * @property {string} id
 * @property {UserRole} role
 * @property {string | null} full_name
 * @property {string | null} phone
 * @property {string | null} avatar_url
 * @property {string} created_at
 * @property {string} updated_at
 */

const listeners = new Set();
let listenerReady = false;

/**
 * Turns a Supabase auth error into a sentence a shopper can act on.
 * @param {unknown} error
 * @returns {string}
 */
export function authErrorMessage(error) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const text = raw.toLowerCase();

  if (text.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (text.includes("email not confirmed")) {
    return "Confirm your email, then sign in.";
  }
  if (text.includes("user already registered") || text.includes("already been registered")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (text.includes("password should be at least") || text.includes("password")) {
    return "Use a password of at least 6 characters.";
  }
  if (text.includes("unable to validate email") || text.includes("invalid email")) {
    return "Enter a valid email address.";
  }
  if (text.includes("service_role") || text.includes("config.js")) {
    return raw;
  }
  if (text.includes("fetch") || text.includes("network") || text.includes("failed to fetch")) {
    return "Could not reach Supabase. Check your connection and the project URL.";
  }
  return raw || "Something went wrong. Try again.";
}

/**
 * @param {string} email
 * @param {string} password
 * @param {string} fullName
 * @returns {Promise<{ needsEmailConfirm: boolean }>}
 */
export async function signUp(email, password, fullName) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: new URL(url("index.html"), window.location.href).href,
    },
  });

  if (error) throw error;
  return { needsEmailConfirm: !data.session };
}

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<void>}
 */
export async function signIn(email, password) {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/**
 * @returns {Promise<void>}
 */
export async function signOut() {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * @returns {Promise<import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm").Session | null>}
 */
export async function getSession() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * Reads the signed-in user's own profiles row, including role.
 * Anonymous visitors and missing rows return null. Role is never written here.
 * @returns {Promise<Profile | null>}
 */
export async function getCurrentProfile() {
  const supabase = getSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    const missing = userError.name === "AuthSessionMissingError"
      || /session missing/i.test(String(userError.message || ""));
    if (missing) return null;
    throw userError;
  }
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone, avatar_url, created_at, updated_at")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * @param {(profile: Profile | null) => void} callback
 * @returns {() => void}
 */
export function onAuthStateChange(callback) {
  listeners.add(callback);
  ensureAuthListener();
  return () => listeners.delete(callback);
}

function ensureAuthListener() {
  if (listenerReady) return;
  listenerReady = true;

  try {
    const supabase = getSupabase();
    supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => {
        getCurrentProfile()
          .catch(() => null)
          .then((profile) => {
            for (const listener of listeners) listener(profile);
          });
      }, 0);
    });
  } catch {
    listenerReady = false;
  }
}

/**
 * Sends guests to login. Sends signed-in users with the wrong role back home.
 * @param {UserRole[]} roles
 * @returns {Promise<Profile | null>}
 */
export async function requireRole(roles) {
  let profile = null;
  try {
    profile = await getCurrentProfile();
  } catch {
    profile = null;
  }

  if (!profile) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign(`${url("pages/login.html")}?redirect=${redirect}`);
    return null;
  }

  if (!roles.includes(profile.role)) {
    window.location.assign(url("index.html"));
    return null;
  }

  return profile;
}

/**
 * @returns {string}
 */
export function redirectAfterAuth() {
  const params = new URLSearchParams(window.location.search);
  return safeNext(params.get("redirect") || params.get("next"));
}

/**
 * Sends a guest to login and brings them back to this page afterwards.
 * @returns {Promise<Profile | null>}
 */
export async function requireUser() {
  const profile = await getCurrentProfile();
  if (!profile) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign(`${url("pages/login.html")}?redirect=${redirect}`);
    return null;
  }
  return profile;
}
