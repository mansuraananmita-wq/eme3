/**
 * Saved delivery addresses (public.addresses).
 * Columns: label, recipient_name, phone, line1, line2, city, district, postal_code, is_default.
 */

import { getCurrentProfile } from "../auth.js?v=3";
import { getSupabase } from "../supabaseClient.js";

const COLUMNS = `
  id, customer_id, label, recipient_name, phone, line1, line2,
  city, district, postal_code, is_default, created_at, updated_at
`;

/** Bangladesh mobile: 01 + 9 digits. */
const BD_MOBILE = /^01[0-9]{9}$/;

/**
 * @param {string} phone
 * @returns {boolean}
 */
export function isBdMobile(phone) {
  return BD_MOBILE.test(String(phone || "").trim());
}

/**
 * @param {object} input
 * @returns {string | null} Error message, or null when valid.
 */
export function validateAddressInput(input) {
  const label = String(input.label || "").trim();
  const recipient = String(input.recipient_name || "").trim();
  const phone = String(input.phone || "").trim();
  const line1 = String(input.line1 || "").trim();
  const city = String(input.city || "").trim();
  const district = String(input.district || "").trim();

  if (label.length < 1 || label.length > 40) return "Label must be 1 to 40 characters.";
  if (recipient.length < 2 || recipient.length > 120) return "Recipient name must be 2 to 120 characters.";
  if (!isBdMobile(phone)) return "Enter a Bangladeshi mobile number like 01XXXXXXXXX.";
  if (line1.length < 3 || line1.length > 180) return "Address line must be 3 to 180 characters.";
  if (city.length < 2 || city.length > 80) return "City must be 2 to 80 characters.";
  if (district.length < 2 || district.length > 80) return "District must be 2 to 80 characters.";
  return null;
}

/**
 * @returns {Promise<Array<object>>}
 */
export async function listAddresses() {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to manage addresses.");

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("addresses")
    .select(COLUMNS)
    .eq("customer_id", profile.id)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * @param {string} id
 * @returns {Promise<object | null>}
 */
export async function getAddress(id) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to manage addresses.");

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("addresses")
    .select(COLUMNS)
    .eq("id", id)
    .eq("customer_id", profile.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Clears other defaults so the partial unique index stays happy.
 * @param {string} customerId
 * @param {string | null} [keepId]
 */
async function clearDefaults(customerId, keepId = null) {
  const supabase = getSupabase();
  let query = supabase
    .from("addresses")
    .update({ is_default: false })
    .eq("customer_id", customerId)
    .eq("is_default", true);

  if (keepId) query = query.neq("id", keepId);
  const { error } = await query;
  if (error) throw error;
}

/**
 * @param {object} input
 * @returns {Promise<object>}
 */
export async function createAddress(input) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to manage addresses.");

  const message = validateAddressInput(input);
  if (message) throw new Error(message);

  const makeDefault = Boolean(input.is_default);
  if (makeDefault) await clearDefaults(profile.id);

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("addresses")
    .insert({
      customer_id: profile.id,
      label: String(input.label).trim(),
      recipient_name: String(input.recipient_name).trim(),
      phone: String(input.phone).trim(),
      line1: String(input.line1).trim(),
      line2: String(input.line2 || "").trim() || null,
      city: String(input.city).trim(),
      district: String(input.district).trim(),
      postal_code: String(input.postal_code || "").trim() || null,
      is_default: makeDefault,
    })
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

/**
 * @param {string} id
 * @param {object} input
 * @returns {Promise<object>}
 */
export async function updateAddress(id, input) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to manage addresses.");

  const message = validateAddressInput(input);
  if (message) throw new Error(message);

  const makeDefault = Boolean(input.is_default);
  if (makeDefault) await clearDefaults(profile.id, id);

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("addresses")
    .update({
      label: String(input.label).trim(),
      recipient_name: String(input.recipient_name).trim(),
      phone: String(input.phone).trim(),
      line1: String(input.line1).trim(),
      line2: String(input.line2 || "").trim() || null,
      city: String(input.city).trim(),
      district: String(input.district).trim(),
      postal_code: String(input.postal_code || "").trim() || null,
      is_default: makeDefault,
    })
    .eq("id", id)
    .eq("customer_id", profile.id)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteAddress(id) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to manage addresses.");

  const supabase = getSupabase();
  const { error } = await supabase
    .from("addresses")
    .delete()
    .eq("id", id)
    .eq("customer_id", profile.id);

  if (error) throw error;
}

/**
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function setDefaultAddress(id) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to manage addresses.");

  await clearDefaults(profile.id, id);

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("addresses")
    .update({ is_default: true })
    .eq("id", id)
    .eq("customer_id", profile.id)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return data;
}
