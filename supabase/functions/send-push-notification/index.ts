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

// ── helpers ──────────────────────────────────────────────────────────

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
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Import raw 32-byte VAPID private key into a CryptoKey. */
async function importPrivateKey(raw32: Uint8Array): Promise<CryptoKey> {
  // Build JWK from raw 32-byte d value
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: base64UrlEncode(raw32.buffer),
    // We need x,y — derive from private key by generating a dummy key then replacing d
    // Instead, import raw into PKCS8
    x: "",
    y: "",
  };

  // Alternative: construct PKCS8 DER
  // prefix for P-256 PKCS8 private key
  const pkcs8Prefix = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86,
    0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8Suffix = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00,
  ]);

  // We need the public key bytes — derive them
  const tempKey = await crypto.subtle.importKey(
    "pkcs8",
    concat(pkcs8Prefix, raw32, pkcs8Suffix, new Uint8Array(65)),
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  ).catch(() => null);

  // Simpler approach: use generateKey then export/import with d
  // Actually, let's just build a proper VAPID JWT with jose-like approach

  return await crypto.subtle.importKey(
    "raw",
    raw32,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
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

/** Create a signed VAPID JWT using Web Crypto (ECDSA P-256). */
async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyRaw: Uint8Array
): Promise<{ token: string; publicKeyBytes: Uint8Array }> {
  // Build PKCS8 from raw 32-byte private key
  // P-256 PKCS8 structure
  const pkcs8Header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86,
    0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);

  // Import as ECDSA key
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );

  // Export the generated key as JWK, then replace d with our private key
  const jwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  jwk.d = base64UrlEncode(privateKeyRaw.buffer);

  // Re-import with our actual d value
  const signingKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );

  // Export public key to get x,y for the public key bytes
  const pubJwk = await crypto.subtle.exportKey("jwk", signingKey);
  const x = base64UrlDecode(pubJwk.x!);
  const y = base64UrlDecode(pubJwk.y!);
  const publicKeyBytes = concat(new Uint8Array([0x04]), x, y);

  // Build JWT
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  };

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const input = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    encoder.encode(input)
  );

  // Convert DER signature to raw r||s format
  const sigBytes = new Uint8Array(signature);
  const rawSig = derToRaw(sigBytes);
  const sigB64 = base64UrlEncode(rawSig.buffer);

  return { token: `${input}.${sigB64}`, publicKeyBytes };
}

/** Convert DER-encoded ECDSA signature to raw 64-byte r||s. */
function derToRaw(der: Uint8Array): Uint8Array {
  // Check if already raw (64 bytes)
  if (der.length === 64) return der;

  const raw = new Uint8Array(64);
  // DER: 0x30 <len> 0x02 <rLen> <r> 0x02 <sLen> <s>
  let offset = 2; // skip 0x30 and total length
  // r
  offset += 1; // 0x02
  const rLen = der[offset++];
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDest = rLen > 32 ? 0 : 32 - rLen;
  raw.set(der.slice(rStart, offset + rLen), rDest);
  offset += rLen;
  // s
  offset += 1; // 0x02
  const sLen = der[offset++];
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDest = sLen > 32 ? 32 : 32 + (32 - sLen);
  raw.set(der.slice(sStart, offset + sLen), sDest);
  return raw;
}

// ── Web Push encryption (RFC 8291) ──────────────────────────────────

async function encryptPayload(
  clientPublicKeyB64: string,
  clientAuthB64: string,
  payload: string
): Promise<{ body: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const clientPublicKeyBytes = base64UrlDecode(clientPublicKeyB64);
  const clientAuth = base64UrlDecode(clientAuthB64);
  const payloadBytes = new TextEncoder().encode(payload);

  // Generate server ECDH key pair
  const serverKeys = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const serverPublicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeys.publicKey)
  );

  // Import client public key
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      serverKeys.privateKey,
      256
    )
  );

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF to derive IKM from auth secret
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

  // Not quite right — we need proper HKDF with auth as salt for IKM
  // Actually RFC 8291:
  // IKM = ECDH(as, ua)
  // PRK = HKDF-Extract(auth_secret, IKM)
  // Then derive CEK and nonce

  const prkBits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: clientAuth,
      info: authInfo,
    },
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

  // CEK
  const cekInfo = concat(
    new TextEncoder().encode("Content-Encoding: aes128gcm\0")
  );
  const cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
    prk,
    128
  );

  // Nonce
  const nonceInfo = concat(
    new TextEncoder().encode("Content-Encoding: nonce\0")
  );
  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
    prk,
    96
  );

  // Encrypt payload with AES-128-GCM
  const cek = await crypto.subtle.importKey(
    "raw",
    cekBits,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Add padding: 1 byte delimiter (0x02) then payload
  const paddedPayload = concat(payloadBytes, new Uint8Array([2]));

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonceBits, tagLength: 128 },
      cek,
      paddedPayload
    )
  );

  // Build aes128gcm content coding header
  // salt (16) || rs (4) || idlen (1) || keyid (65) || ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);

  const header = concat(
    salt,
    rs,
    new Uint8Array([serverPublicKey.length]),
    serverPublicKey
  );

  const body = concat(header, encrypted);

  return { body, salt, serverPublicKey };
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

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("VAPID keys not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: PushPayload = await req.json();
    const userIds =
      payload.user_ids || (payload.user_id ? [payload.user_id] : []);

    if (userIds.length === 0) {
      throw new Error("No user_id or user_ids provided");
    }

    // Get push subscriptions for users
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIds);

    if (subError) throw subError;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subscriptions found", sent: 0 }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
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

    // Send push notifications
    const results = await Promise.allSettled(
      subscriptions.map(async (sub: Record<string, string>) => {
        try {
          // Skip native APNs subscriptions — they use FCM, not Web Push
          if (sub.endpoint.startsWith("apns://")) {
            console.log("Skipping APNs subscription (native):", sub.id);
            return false;
          }

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
            console.error(
              `Push failed for ${sub.id}: ${response.status} ${respText}`
            );

            // Remove gone subscriptions
            if (response.status === 410 || response.status === 404) {
              await supabase
                .from("push_subscriptions")
                .delete()
                .eq("id", sub.id);
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

          // Consume response body
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
        } catch (error: unknown) {
          console.error("Push error for subscription:", sub.id, error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
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

    const sent = results.filter(
      (r) => r.status === "fulfilled" && r.value
    ).length;

    return new Response(
      JSON.stringify({
        message: "Push notifications sent",
        sent,
        total: subscriptions.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error in send-push-notification:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
