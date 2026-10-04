/**
 * Writes product view, cart, purchase, and search rows to user_events.
 * Failures stay in the console so the shopper action still finishes.
 */

import { getCurrentProfile } from "../auth.js?v=3";
import { getSupabase } from "../supabaseClient.js";

const SESSION_KEY = "eme-session";
const RECENT_KEY = "eme-recent-products";

/**
 * @returns {string}
 */
function sessionId() {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing && existing.length >= 8 && existing.length <= 128) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return "eme-session-local";
  }
}

/**
 * Product ids this browser has opened, newest first.
 * @returns {string[]}
 */
export function recentProductIds() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === "string" && id).slice(0, 8);
  } catch {
    return [];
  }
}

/**
 * @param {string} productId
 */
function rememberProduct(productId) {
  try {
    const next = [productId, ...recentProductIds().filter((id) => id !== productId)].slice(0, 8);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/**
 * @param {"view" | "add_to_cart" | "purchase" | "search"} eventType
 * @param {"product" | "reel" | "live" | "category"} entityType
 * @param {string | null} entityId
 * @param {Record<string, string | number>} [metadata]
 */
export function recordCatalogEvent(eventType, entityType, entityId, metadata = {}) {
  if (eventType === "view" && entityType === "product" && entityId) {
    const seenKey = `eme-product-view-${entityId}`;
    try {
      if (window.sessionStorage.getItem(seenKey)) return;
      window.sessionStorage.setItem(seenKey, "1");
    } catch {
      /* still record */
    }
    rememberProduct(entityId);
  }

  const send = async () => {
    const profile = await getCurrentProfile().catch(() => null);
    /** @type {Record<string, unknown>} */
    const row = {
      session_id: sessionId(),
      event_type: eventType,
      entity_type: entityType,
      metadata,
    };
    if (entityId) row.entity_id = entityId;
    if (profile?.id) row.user_id = profile.id;
    const { error } = await getSupabase().from("user_events").insert(row);
    if (error) console.error("user_events:", error);
  };

  send().catch((error) => console.error("user_events:", error));
}
