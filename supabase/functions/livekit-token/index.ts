/**
 * Mints a LiveKit room token for one EME live stream.
 * Secrets stay here: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.
 * The browser only receives a short-lived token. It never sees the API secret.
 *
 * Deploy:
 *   supabase functions deploy livekit-token
 *   supabase secrets set LIVEKIT_URL=wss://YOUR.livekit.cloud LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=...
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const apiKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
    const livekitUrl = Deno.env.get("LIVEKIT_URL") ?? "";
    if (!apiKey || !apiSecret || !livekitUrl.startsWith("wss://")) {
      return json({
        error: "Live video is not configured yet. Add LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET to the livekit-token function.",
      }, 503);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const body = await req.json().catch(() => ({}));
    const streamId = String(body?.stream_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(streamId)) {
      return json({ error: "Choose a live room." }, 400);
    }

    const { data: stream, error } = await supabase
      .from("live_streams")
      .select("id, vendor_id, status, livekit_room_name")
      .eq("id", streamId)
      .maybeSingle();

    if (error) {
      console.error("livekit-token stream:", error);
      return json({ error: "Could not open this live room." }, 500);
    }
    if (!stream) return json({ error: "This live room is not available." }, 404);
    if (stream.status !== "live") return json({ error: "This room is not live yet." }, 409);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? "";
    const publish = userId !== "" && userId === stream.vendor_id;
    const identity = userId || `guest-${crypto.randomUUID()}`;
    const token = await livekitToken({
      apiKey,
      apiSecret,
      identity,
      room: stream.livekit_room_name,
      publish,
    });

    return json({ token, url: livekitUrl, publish });
  } catch (error) {
    console.error("livekit-token:", error);
    return json({ error: "Could not start live video." }, 500);
  }
});

/**
 * @param {unknown} body
 * @param {number} status
 */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/**
 * @param {{ apiKey: string, apiSecret: string, identity: string, room: string, publish: boolean }} input
 * @returns {Promise<string>}
 */
async function livekitToken(input) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: input.apiKey,
    sub: input.identity,
    nbf: now - 10,
    exp: now + 60 * 60 * 4,
    video: {
      room: input.room,
      roomJoin: true,
      canPublish: input.publish,
      canSubscribe: true,
      canPublishData: false,
    },
  }));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(input.apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${base64Url(new Uint8Array(signed))}`;
}

/**
 * @param {string | Uint8Array} value
 * @returns {string}
 */
function base64Url(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
