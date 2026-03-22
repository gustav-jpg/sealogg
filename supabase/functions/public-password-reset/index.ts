import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateOtpCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1000000).padStart(6, "0");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("Missing RESEND_API_KEY");
    }

    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Generate recovery link
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    const hashedToken = linkData?.properties?.hashed_token;
    if (!hashedToken) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create an invitation_token with OTP code as fallback
    const otpCode = generateOtpCode();
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1); // 24h for password resets

    await supabaseAdmin.from("invitation_tokens").insert({
      token: inviteToken,
      user_email: email.toLowerCase().trim(),
      otp_code: otpCode,
      expires_at: expiresAt.toISOString(),
    });

    const resetLink = `https://sealogg.se/portal/reset-password?invite_token=${inviteToken}`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SeaLogg <noreply@sealogg.se>",
        to: [email],
        subject: "Återställ ditt lösenord - SeaLogg",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #0077b6; }
              .content { padding: 30px 0; }
              .button { display: inline-block; padding: 14px 28px; background-color: #0077b6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
              .code-box { background-color: #f0f9ff; border: 2px dashed #0077b6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
              .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0077b6; font-family: monospace; }
              .divider { text-align: center; color: #999; margin: 20px 0; font-size: 13px; }
              .footer { padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <img src="https://sealogg.se/sealog-logo.png" alt="SeaLogg" style="height: 50px; width: auto;" />
              </div>
              <div class="content">
                <h2>Återställ lösenord</h2>
                <p>Klicka på knappen nedan för att välja ett nytt lösenord:</p>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${resetLink}" class="button" style="color: white;">Återställ lösenord</a>
                </p>
                <div class="divider">─── Fungerar inte länken? Använd koden nedan ───</div>
                <div class="code-box">
                  <p style="margin: 0 0 10px; font-size: 14px; color: #666;">Din engångskod:</p>
                  <div class="code">${otpCode}</div>
                </div>
                <p style="font-size: 13px; color: #666; text-align: center;">Ange koden på <a href="https://sealogg.se/portal/reset-password">sealogg.se/portal/reset-password</a> tillsammans med din e-postadress.</p>
                <p><small>Giltig i 24 timmar. Om du inte begärt detta kan du ignorera detta mail.</small></p>
              </div>
              <div class="footer">
                <p>Med vänliga hälsningar,<br>SeaLogg-teamet</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("public-password-reset error:", error);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
