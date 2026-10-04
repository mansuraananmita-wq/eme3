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
 * Marks a delivered order refunded. Stock is not restored.
 * @param {string} orderId
 * @param {string} [note]
 * @returns {Promise<void>}
 */
export async function refundOrder(orderId, note) {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("admin_refund_order", {
    p_order_id: orderId,
    p_note: note || null,
  });
  if (error) {
    console.error("admin_refund_order:", error);
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
    .select("id, status, payment_status, total, currency, created_at, customer_id, profiles(full_name)")
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
      paymentStatus: row.payment_status,
      total: row.total,
      currency: row.currency,
      createdAt: row.created_at,
      customer: profile?.full_name || "Customer",
    };
  });
}

const ROLES = ["customer", "vendor", "admin"];
const DISPUTE_STATUSES = ["open", "investigating", "resolved", "rejected"];
const PAYOUT_STATUSES = ["pending", "paid", "failed"];

/**
 * Profiles an admin can see. Email stays in auth.users.
 * @returns {Promise<Array<{ id: string, fullName: string, role: string, createdAt: string }>>}
 */
export async function listProfiles() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("listProfiles:", error);
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name || "User",
    role: row.role,
    createdAt: row.created_at,
  }));
}

/**
 * @param {string} userId
 * @param {string} role
 * @returns {Promise<void>}
 */
export async function setUserRole(userId, role) {
  if (!ROLES.includes(role)) throw new Error("Role must be customer, vendor, or admin.");
  const supabase = getSupabase();
  const { error } = await supabase.rpc("set_user_role", {
    user_id: userId,
    new_role: role,
  });
  if (error) {
    console.error("set_user_role:", error);
    throw error;
  }
}

/**
 * Every category, including inactive ones. Admins can select those.
 * @returns {Promise<Array<object>>}
 */
export async function listAdminCategories() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("categories")
    .select("id, parent_id, name, slug, image_url, sort_order, is_active")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("listAdminCategories:", error);
    throw error;
  }
  return data ?? [];
}

/**
 * @param {{
 *   id?: string,
 *   parentId?: string | null,
 *   name: string,
 *   slug: string,
 *   imageUrl?: string,
 *   sortOrder?: number,
 *   isActive?: boolean,
 * }} input
 * @returns {Promise<void>}
 */
export async function saveCategory(input) {
  const name = String(input.name || "").trim();
  const slug = String(input.slug || "").trim();
  if (name.length < 2 || name.length > 80) throw new Error("Name must be 2 to 80 characters.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Slug must be lowercase letters, numbers, and hyphens.");
  }
  const sortOrder = Number(input.sortOrder ?? 0);
  if (!Number.isInteger(sortOrder)) throw new Error("Sort order must be a whole number.");
  if (input.parentId && input.id && input.parentId === input.id) {
    throw new Error("A category cannot be its own parent.");
  }

  const row = {
    parent_id: input.parentId || null,
    name,
    slug,
    image_url: String(input.imageUrl || "").trim() || null,
    sort_order: sortOrder,
    is_active: input.isActive !== false,
  };

  const supabase = getSupabase();
  const query = input.id
    ? supabase.from("categories").update(row).eq("id", input.id)
    : supabase.from("categories").insert(row);
  const { error } = await query;
  if (error) {
    console.error("saveCategory:", error);
    if (error.code === "23505") throw new Error("That slug is already used.");
    throw error;
  }
}

/**
 * @returns {Promise<Array<{ key: string, value: unknown }>>}
 */
export async function listPlatformSettings() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("key, value")
    .order("key", { ascending: true });

  if (error) {
    console.error("listPlatformSettings:", error);
    throw error;
  }
  return data ?? [];
}

/**
 * Updates one existing setting. Does not invent new keys.
 * @param {string} key
 * @param {unknown} value
 * @returns {Promise<void>}
 */
export async function savePlatformSetting(key, value) {
  if (!/^[a-z0-9_]+$/.test(key)) throw new Error("Setting key is not valid.");
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("platform_settings")
    .update({ value })
    .eq("key", key)
    .select("key");

  if (error) {
    console.error("savePlatformSetting:", error);
    throw error;
  }
  if (!data?.length) throw new Error(`Setting ${key} was not found.`);
}

/**
 * @returns {Promise<Array<object>>}
 */
export async function listDisputes() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("disputes")
    .select("id, order_id, reason, status, resolution_note, created_at, profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    console.error("listDisputes:", error);
    throw error;
  }

  return (data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      orderId: row.order_id,
      reason: row.reason,
      status: row.status,
      resolutionNote: row.resolution_note || "",
      createdAt: row.created_at,
      openedBy: profile?.full_name || "Customer",
    };
  });
}

/**
 * @param {string} disputeId
 * @param {string} status
 * @param {string} note
 * @returns {Promise<void>}
 */
export async function setDisputeStatus(disputeId, status, note) {
  if (!DISPUTE_STATUSES.includes(status)) throw new Error("Dispute status is not valid.");
  const resolution = String(note || "").trim();
  if (resolution && (resolution.length < 1 || resolution.length > 2000)) {
    throw new Error("Resolution note must be 1 to 2000 characters.");
  }
  const supabase = getSupabase();
  const { error } = await supabase
    .from("disputes")
    .update({
      status,
      resolution_note: resolution || null,
    })
    .eq("id", disputeId);

  if (error) {
    console.error("setDisputeStatus:", error);
    throw error;
  }
}

/**
 * Approved shops that can receive a payout.
 * @returns {Promise<Array<{ id: string, shopName: string }>>}
 */
export async function listApprovedShops() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vendor_profiles")
    .select("profile_id, shop_name")
    .eq("status", "approved")
    .order("shop_name", { ascending: true });

  if (error) {
    console.error("listApprovedShops:", error);
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: row.profile_id,
    shopName: row.shop_name,
  }));
}

/**
 * @returns {Promise<Array<object>>}
 */
export async function listPayouts() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("payouts")
    .select("id, vendor_id, amount, currency, period_start, period_end, status, reference, created_at, vendor_profiles(shop_name)")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    console.error("listPayouts:", error);
    throw error;
  }

  return (data ?? []).map((row) => {
    const shop = Array.isArray(row.vendor_profiles) ? row.vendor_profiles[0] : row.vendor_profiles;
    return {
      id: row.id,
      vendorId: row.vendor_id,
      shopName: shop?.shop_name || "Shop",
      amount: row.amount,
      currency: row.currency,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      status: row.status,
      reference: row.reference || "",
      createdAt: row.created_at,
    };
  });
}

/**
 * @param {{
 *   vendorId: string,
 *   amount: number,
 *   periodStart: string,
 *   periodEnd: string,
 *   status?: string,
 *   reference?: string,
 * }} input
 * @returns {Promise<void>}
 */
export async function createPayout(input) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Amount must be zero or more.");
  if (!input.vendorId) throw new Error("Choose a shop.");
  if (!input.periodStart || !input.periodEnd) throw new Error("Choose a period.");
  if (input.periodEnd < input.periodStart) throw new Error("Period end must be on or after the start.");
  const status = input.status || "pending";
  if (!PAYOUT_STATUSES.includes(status)) throw new Error("Payout status is not valid.");
  const reference = String(input.reference || "").trim();

  const supabase = getSupabase();
  const { error } = await supabase.from("payouts").insert({
    vendor_id: input.vendorId,
    amount,
    currency: "BDT",
    period_start: input.periodStart,
    period_end: input.periodEnd,
    status,
    reference: reference || null,
  });
  if (error) {
    console.error("createPayout:", error);
    if (error.code === "23505") throw new Error("That payout reference is already used.");
    throw error;
  }
}

/**
 * @param {string} payoutId
 * @param {string} status
 * @param {string} reference
 * @returns {Promise<void>}
 */
export async function setPayoutStatus(payoutId, status, reference) {
  if (!PAYOUT_STATUSES.includes(status)) throw new Error("Payout status is not valid.");
  const ref = String(reference || "").trim();
  const supabase = getSupabase();
  const { error } = await supabase
    .from("payouts")
    .update({
      status,
      reference: ref || null,
    })
    .eq("id", payoutId);
  if (error) {
    console.error("setPayoutStatus:", error);
    if (error.code === "23505") throw new Error("That payout reference is already used.");
    throw error;
  }
}

/**
 * Counts for the admin dashboard. Uses tables the admin can already read.
 * @returns {Promise<{ pendingVendors: number, approvedVendors: number, suspendedVendors: number, orders: number, openDisputes: number, liveNow: number, products: number, reels: number }>}
 */
export async function adminSnapshot() {
  const supabase = getSupabase();

  /**
   * @param {string} table
   * @param {string} column
   * @param {(query: any) => any} [filter]
   */
  async function count(table, column, filter) {
    let query = supabase.from(table).select(column, { count: "exact", head: true });
    if (filter) query = filter(query);
    const pending = query.then(({ count: total, error }) => {
      if (error) {
        console.error(`admin count ${table}:`, error);
        return 0;
      }
      return total ?? 0;
    });
    const timeout = new Promise((resolve) => {
      window.setTimeout(() => resolve(0), 6000);
    });
    try {
      return await Promise.race([pending, timeout]);
    } catch (error) {
      console.error(`admin count ${table}:`, error);
      return 0;
    }
  }

  const [
    pendingVendors,
    approvedVendors,
    suspendedVendors,
    orders,
    openDisputes,
    liveNow,
    products,
    reels,
  ] = await Promise.all([
    count("vendor_profiles", "profile_id", (query) => query.eq("status", "pending")),
    count("vendor_profiles", "profile_id", (query) => query.eq("status", "approved")),
    count("vendor_profiles", "profile_id", (query) => query.eq("status", "suspended")),
    count("orders", "id"),
    count("disputes", "id", (query) => query.eq("status", "open")),
    count("live_streams", "id", (query) => query.eq("status", "live")),
    count("products", "id", (query) => query.eq("status", "active")),
    count("reels", "id", (query) => query.neq("status", "removed")),
  ]);

  return {
    pendingVendors,
    approvedVendors,
    suspendedVendors,
    orders,
    openDisputes,
    liveNow,
    products,
    reels,
  };
}
