/**
 * Admin panel API. Writes go through security-definer RPCs that check is_admin().
 */

import { getSupabase } from "../supabaseClient.js";

/**
 * Server-side admin check. False for guests and non-admins.
 * @returns {Promise<boolean>}
 */
export async function adminPanelAccess() {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_panel_access");
  if (error) {
    console.error("admin_panel_access:", error);
    throw error;
  }
  return data === true;
}

/**
 * @returns {Promise<Array<object>>}
 */
export async function listVendorApplications() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vendor_profiles")
    .select("profile_id, shop_name, slug, status, created_at, profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("listVendorApplications:", error);
    throw error;
  }

  return (data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.profile_id,
      shopName: row.shop_name,
      slug: row.slug,
      status: row.status,
      createdAt: row.created_at,
      applicant: profile?.full_name || "Applicant",
    };
  });
}

/**
 * @param {string} vendorId
 * @param {"pending" | "approved" | "suspended"} status
 * @returns {Promise<void>}
 */
export async function setVendorStatus(vendorId, status) {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("admin_set_vendor_status", {
    vendor_id: vendorId,
    new_status: status,
  });
  if (error) {
    console.error("admin_set_vendor_status:", error);
    throw error;
  }
}

/**
 * Recent reels an admin can moderate.
 * @returns {Promise<Array<object>>}
 */
export async function listModerationReels() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reels")
    .select("id, caption, status, created_at, vendor_profiles(shop_name)")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    console.error("listModerationReels:", error);
    throw error;
  }

  return (data ?? []).map((row) => {
    const shop = Array.isArray(row.vendor_profiles) ? row.vendor_profiles[0] : row.vendor_profiles;
    return {
      id: row.id,
      caption: row.caption || "Untitled reel",
      status: row.status,
      createdAt: row.created_at,
      shopName: shop?.shop_name || "Shop",
    };
  });
}

/**
 * Recent products an admin can moderate.
 * @returns {Promise<Array<object>>}
 */
export async function listModerationProducts() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("id, title, status, created_at, vendor_profiles(shop_name)")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    console.error("listModerationProducts:", error);
    throw error;
  }

  return (data ?? []).map((row) => {
    const shop = Array.isArray(row.vendor_profiles) ? row.vendor_profiles[0] : row.vendor_profiles;
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      createdAt: row.created_at,
      shopName: shop?.shop_name || "Shop",
    };
  });
}

/**
 * @param {string} reelId
 * @returns {Promise<void>}
 */
export async function removeReel(reelId) {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("admin_set_reel_status", {
    reel_id: reelId,
    new_status: "removed",
  });
  if (error) {
    console.error("admin_set_reel_status:", error);
    throw error;
  }
}

/**
 * @param {string} productId
 * @returns {Promise<void>}
 */
export async function archiveProduct(productId) {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("admin_set_product_status", {
    product_id: productId,
    new_status: "archived",
  });
  if (error) {
    console.error("admin_set_product_status:", error);
    throw error;
  }
}

/**
 * All orders. RLS returns every row only for admins.
 * @returns {Promise<Array<object>>}
 */
export async function listAllOrders() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, total, currency, created_at, customer_id, profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    console.error("listAllOrders:", error);
    throw error;
  }

  return (data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      status: row.status,
      total: row.total,
      currency: row.currency,
      createdAt: row.created_at,
      customer: profile?.full_name || "Customer",
    };
  });
}
