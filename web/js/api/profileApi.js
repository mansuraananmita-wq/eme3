/**
 * Own profile reads/writes and avatar upload to the avatars bucket.
 * Editable columns: full_name, phone, avatar_url. Role and email are read-only.
 */

import { getCurrentProfile, getSession } from "../auth.js";
import { getSupabase } from "../supabaseClient.js";
import { isBdMobile } from "./addressApi.js";

const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const AVATAR_MAX = 2 * 1024 * 1024;

/**
 * @returns {Promise<{ profile: object, email: string | null }>}
 */
export async function getAccountProfile() {
  const [profile, session] = await Promise.all([getCurrentProfile(), getSession()]);
  if (!profile) throw new Error("Sign in to view your profile.");
  return {
    profile,
    email: session?.user?.email || null,
  };
}

/**
 * @param {{ full_name?: string | null, phone?: string | null }} input
 * @returns {Promise<object>}
 */
export async function updateProfile(input) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to update your profile.");

  const fullName = input.full_name == null ? null : String(input.full_name).trim();
  const phone = input.phone == null ? null : String(input.phone).trim();

  if (fullName !== null && fullName !== "" && (fullName.length < 1 || fullName.length > 120)) {
    throw new Error("Name must be 1 to 120 characters.");
  }
  if (phone) {
    if (phone.startsWith("01")) {
      if (!isBdMobile(phone)) throw new Error("Enter a Bangladeshi mobile number like 01XXXXXXXXX.");
    } else if (phone.length < 6 || phone.length > 20) {
      throw new Error("Phone must be 6 to 20 characters.");
    }
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName || null,
      phone: phone || null,
    })
    .eq("id", profile.id)
    .select("id, role, full_name, phone, avatar_url, created_at, updated_at")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Uploads to avatars/{user_id}/{filename}, then stores the public URL on profiles.avatar_url.
 * @param {File} file
 * @returns {Promise<object>}
 */
export async function uploadAvatar(file) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to upload an avatar.");

  if (!(file instanceof File)) throw new Error("Choose an image file.");
  if (!AVATAR_TYPES.has(file.type)) {
    throw new Error("Use a JPEG, PNG, WebP, or GIF image.");
  }
  if (file.size > AVATAR_MAX) throw new Error("Avatar must be under 2 MB.");

  const ext = extensionFor(file);
  const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
  const supabase = getSupabase();

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });

  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = publicData?.publicUrl;
  if (!avatarUrl) throw new Error("Could not build the avatar URL.");

  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", profile.id)
    .select("id, role, full_name, phone, avatar_url, created_at, updated_at")
    .single();

  if (error) throw error;
  return data;
}

/**
 * @param {string} password
 * @returns {Promise<void>}
 */
export async function changePassword(password) {
  if (String(password || "").length < 6) {
    throw new Error("Use a password of at least 6 characters.");
  }
  const supabase = getSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/**
 * @param {File} file
 * @returns {string}
 */
function extensionFor(file) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}
