import { getSupabase } from "./supabaseClient.js";
import { safeNext, url } from "./paths.js?v=4";

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
  const raw = readErrorText(error);
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
 * Supabase errors are objects with a message, not always Error instances.
 * @param {unknown} error
 * @returns {string}
 */
function readErrorText(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "";
}

/**
 * @param {string} email
 * @param {string} password
 * @param {string} fullName
 * @param {'customer' | 'vendor'} [role]
 * @param {string} [shopName]
 * @returns {Promise<{ needsEmailConfirm: boolean }>}
 */
export async function signUp(email, password, fullName, role = "customer", shopName = "") {
  const supabase = getSupabase();
  const chosen = role === "vendor" ? "vendor" : "customer";
  /** @type {Record<string, string>} */
  const meta = { full_name: fullName, signup_role: chosen };
  if (chosen === "vendor" && shopName.trim()) meta.shop_name = shopName.trim();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: meta,
      emailRedirectTo: new URL(url("index.html"), window.location.href).href,
    },
  });

  if (error) throw error;
  return { needsEmailConfirm: !data.session };
}

/**
 * Sets the signed-in account to customer or vendor.
 * Vendor also creates or approves that user's shop.
 * Admin cannot be claimed from the browser.
 * Needs supabase/f10_signup_roles.sql applied once.
 * @param {'customer' | 'vendor'} role
 * @param {string} [shopName]
 * @returns {Promise<void>}
 */
export async function claimAccountRole(role, shopName = "") {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("claim_account_role", {
    new_role: role,
    shop_name: shopName.trim() || null,
  });
  if (error) throw error;
}

/**
 * @param {unknown} error
 * @returns {string}
 */
export function roleChangeMessage(error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const text = error instanceof Error ? error.message : String(error ?? "");
  if (code === "PGRST202" || /claim_account_role/i.test(text) || /schema cache/i.test(text)) {
    return "Run supabase/f10_signup_roles.sql once in the Supabase SQL editor. After that, pick customer or vendor here. The email role update is not needed.";
  }
  return authErrorMessage(error);
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
 * Emails a recovery link. The link returns to the profile page, where the password can be changed.
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function sendPasswordReset(email) {
  const supabase = getSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: new URL(url("pages/account/profile.html"), window.location.href).href,
  });
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
  const user = await sessionUser();
  if (!user) return null;

  const supabase = getSupabase();
  const query = supabase
    .from("profiles")
    .select("id, role, full_name, phone, avatar_url, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();
  const { data, error } = await raceTimeout(query, "Your account took too long to load. Refresh the page.");
  if (error) throw error;
  return data;
}

/**
 * Local session only. getUser() can stay pending and leave the page on a blank skeleton.
 * @returns {Promise<{ id: string } | null>}
 */
async function sessionUser() {
  const supabase = getSupabase();
  const result = await raceTimeout(
    supabase.auth.getSession(),
    "Sign-in check timed out. Refresh the page.",
  );
  if (result.error) {
    const missing = result.error.name === "AuthSessionMissingError"
      || /session missing/i.test(String(result.error.message || ""));
    if (missing) return null;
    throw result.error;
  }
  return result.data.session?.user ?? null;
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {string} message
 * @returns {Promise<T>}
 */
function raceTimeout(promise, message) {
  let timer = 0;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), 8000);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
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
    const redirect = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
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
    const redirect = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
    window.location.assign(`${url("pages/login.html")}?redirect=${redirect}`);
    return null;
  }
  return profile;
}
