import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  user_id?: string;
  user_ids?: string[];
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

// ── base64url helpers ───────────────────────────────────────────────

function base64UrlDecode(s: string): Uint8Array {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (b.length % 4)) % 4);
  const raw = atob(b + pad);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(len);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ── APNs JWT (ES256) ────────────────────────────────────────────────

async function createApnsJwt(
  teamId: string,
  keyId: string,
  privateKeyPem: string
): Promise<string> {
  // Parse PEM to DER
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const header = { alg: "ES256", kid: keyId };
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: teamId, iat: now };

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const claimsB64 = base64UrlEncode(encoder.encode(JSON.stringify(claims)));
  const input = `${headerB64}.${claimsB64}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(input)
  );

  // Convert DER signature to raw r||s
  const sigBytes = new Uint8Array(signature);
  const rawSig = derToRaw(sigBytes);
  const sigB64 = base64UrlEncode(rawSig.buffer);

  return `${input}.${sigB64}`;
}

function derToRaw(der: Uint8Array): Uint8Array {
  if (der.length === 64) return der;
  const raw = new Uint8Array(64);
  let offset = 2;
  offset += 1;
  const rLen = der[offset++];
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDest = rLen > 32 ? 0 : 32 - rLen;
  raw.set(der.slice(rStart, offset + rLen), rDest);
  offset += rLen;
  offset += 1;
  const sLen = der[offset++];
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDest = sLen > 32 ? 32 : 32 + (32 - sLen);
  raw.set(der.slice(sStart, offset + sLen), sDest);
  return raw;
}

// ── Send to APNs ───────────────────────────────────────────────────

async function sendApns(
  deviceToken: string,
  jwt: string,
  bundleId: string,
  payload: object,
  options?: { sandbox?: boolean }
): Promise<{ ok: boolean; status: number; body: string }> {
  const host = options?.sandbox ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  const url = `https://${host}/3/device/${deviceToken}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": "0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  return { ok: response.ok, status: response.status, body };
}

function isBadDeviceToken(status: number, body: string): boolean {
  if (status !== 400) return false;

  try {
    const parsed = JSON.parse(body) as { reason?: string };
    return parsed.reason === "BadDeviceToken";
  } catch {
    return body.includes("BadDeviceToken");
  }
}

// ── Web Push (VAPID + aes128gcm) ────────────────────────────────────

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyRaw: Uint8Array
): Promise<{ token: string; publicKeyBytes: Uint8Array }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );

  const jwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  jwk.d = base64UrlEncode(privateKeyRaw.buffer);

  const signingKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );

  const pubJwk = await crypto.subtle.exportKey("jwk", signingKey);
  const x = base64UrlDecode(pubJwk.x!);
  const y = base64UrlDecode(pubJwk.y!);
  const publicKeyBytes = concat(new Uint8Array([0x04]), x, y);

  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const input = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    encoder.encode(input)
  );

  const sigBytes = new Uint8Array(signature);
  const rawSig = derToRaw(sigBytes);
  const sigB64 = base64UrlEncode(rawSig.buffer);

  return { token: `${input}.${sigB64}`, publicKeyBytes };
}

async function encryptPayload(
  clientPublicKeyB64: string,
  clientAuthB64: string,
  payload: string
): Promise<{ body: Uint8Array }> {
  const clientPublicKeyBytes = base64UrlDecode(clientPublicKeyB64);
  const clientAuth = base64UrlDecode(clientAuthB64);
  const payloadBytes = new TextEncoder().encode(payload);

  const serverKeys = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const serverPublicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeys.publicKey)
  );

  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      serverKeys.privateKey,
      256
    )
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const authInfo = concat(
    new TextEncoder().encode("WebPush: info\0"),
    clientPublicKeyBytes,
    serverPublicKey
  );

  const prkKey = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );

  const prkBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: clientAuth, info: authInfo },
    prkKey,
    256
  );

  const prk = await crypto.subtle.importKey(
    "raw",
    prkBits,
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );

  const cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: new TextEncoder().encode("Content-Encoding: aes128gcm\0") },
    prk,
    128
  );

  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: new TextEncoder().encode("Content-Encoding: nonce\0") },
    prk,
    96
  );

  const cek = await crypto.subtle.importKey(
    "raw",
    cekBits,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const paddedPayload = concat(payloadBytes, new Uint8Array([2]));

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonceBits, tagLength: 128 },
      cek,
      paddedPayload
    )
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);

  const header = concat(
    salt,
    rs,
    new Uint8Array([serverPublicKey.length]),
    serverPublicKey
  );

  return { body: concat(header, encrypted) };
}

// ── main handler ────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const apnsAuthKey = Deno.env.get("APNS_AUTH_KEY") || "";
    const apnsKeyId = Deno.env.get("APNS_KEY_ID") || "";
    const apnsTeamId = Deno.env.get("APNS_TEAM_ID") || "";

    const BUNDLE_ID = "app.lovable.ca12acbb7d5746d89d77109ee6b9dc68";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: PushPayload = await req.json();
    const userIds =
      payload.user_ids || (payload.user_id ? [payload.user_id] : []);

    if (userIds.length === 0) {
      throw new Error("No user_id or user_ids provided");
    }

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIds);

    if (subError) throw subError;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subscriptions found", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const privateKeyRaw = base64UrlDecode(vapidPrivateKey);

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      tag: payload.tag || "sealogg-notification",
      data: { url: payload.url || "/portal" },
    });

    // Cache APNs JWT (valid for ~1 hour)
    let apnsJwt: string | null = null;
    if (apnsAuthKey && apnsKeyId && apnsTeamId) {
      try {
        apnsJwt = await createApnsJwt(apnsTeamId, apnsKeyId, apnsAuthKey);
      } catch (e) {
        console.error("Failed to create APNs JWT:", e);
      }
    }

    const results = await Promise.allSettled(
      subscriptions.map(async (sub: Record<string, string>) => {
        try {
          const isApns = sub.endpoint.startsWith("apns://");

          if (isApns) {
            // ── Native iOS via APNs direct ──
            if (!apnsJwt) {
              console.error("APNs JWT not available, skipping native push for", sub.id);
              return false;
            }

            const deviceToken = sub.endpoint.replace("apns://", "");
            const apnsPayload = {
              aps: {
                alert: {
                  title: payload.title,
                  body: payload.body,
                },
                sound: "default",
                badge: 1,
              },
              url: payload.url || "/portal",
            };

            let result = await sendApns(deviceToken, apnsJwt, BUNDLE_ID, apnsPayload);

            // Xcode/debug builds often use sandbox tokens. Retry once against sandbox APNs.
            if (!result.ok && isBadDeviceToken(result.status, result.body)) {
              console.warn(`APNs production rejected token for ${sub.id}, retrying sandbox`);
              result = await sendApns(deviceToken, apnsJwt, BUNDLE_ID, apnsPayload, { sandbox: true });
            }

            if (!result.ok) {
              console.error(`APNs push failed for ${sub.id}: ${result.status} ${result.body}`);

              // Remove invalid tokens
              if (result.status === 410 || result.status === 400) {
                await supabase.from("push_subscriptions").delete().eq("id", sub.id);
                console.log(`Removed invalid APNs subscription ${sub.id}`);
              }

              await supabase.from("notification_logs").insert({
                user_id: sub.user_id,
                notification_type: "push",
                category: payload.tag || "general",
                subject: payload.title,
                body: payload.body,
                status: "failed",
                error_message: `APNs ${result.status}: ${result.body}`,
              });

              return false;
            }

            await supabase.from("notification_logs").insert({
              user_id: sub.user_id,
              notification_type: "push",
              category: payload.tag || "general",
              subject: payload.title,
              body: payload.body,
              status: "sent",
              sent_at: new Date().toISOString(),
            });

            console.log(`APNs push sent for ${sub.id}`);
            return true;
          } else {
            // ── Web Push via VAPID ──
            const endpointUrl = new URL(sub.endpoint);
            const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

            const { token, publicKeyBytes } = await createVapidJwt(
              audience,
              "mailto:support@sealogg.se",
              privateKeyRaw
            );

            const { body } = await encryptPayload(
              sub.p256dh,
              sub.auth,
              notificationPayload
            );

            const response = await fetch(sub.endpoint, {
              method: "POST",
              headers: {
                Authorization: `vapid t=${token}, k=${base64UrlEncode(publicKeyBytes.buffer)}`,
                "Content-Encoding": "aes128gcm",
                "Content-Type": "application/octet-stream",
                TTL: "86400",
                Urgency: "high",
              },
              body,
            });

            if (!response.ok) {
              const respText = await response.text();
              console.error(`Push failed for ${sub.id}: ${response.status} ${respText}`);

              if (response.status === 410 || response.status === 404) {
                await supabase.from("push_subscriptions").delete().eq("id", sub.id);
              }

              await supabase.from("notification_logs").insert({
                user_id: sub.user_id,
                notification_type: "push",
                category: payload.tag || "general",
                subject: payload.title,
                body: payload.body,
                status: "failed",
                error_message: `HTTP ${response.status}: ${respText}`,
              });

              return false;
            }

            await response.text();

            await supabase.from("notification_logs").insert({
              user_id: sub.user_id,
              notification_type: "push",
              category: payload.tag || "general",
              subject: payload.title,
              body: payload.body,
              status: "sent",
              sent_at: new Date().toISOString(),
            });

            return true;
          }
        } catch (error: unknown) {
          console.error("Push error for subscription:", sub.id, error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          await supabase.from("notification_logs").insert({
            user_id: sub.user_id,
            notification_type: "push",
            category: payload.tag || "general",
            subject: payload.title,
            body: payload.body,
            status: "failed",
            error_message: errorMessage,
          });
          return false;
        }
      })
    );

    const sent = results.filter((r) => r.status === "fulfilled" && r.value).length;

    return new Response(
      JSON.stringify({ message: "Push notifications sent", sent, total: subscriptions.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("Error in send-push-notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
