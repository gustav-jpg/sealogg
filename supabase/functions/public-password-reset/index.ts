import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PublicPasswordResetRequest {
  email: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("Missing RESEND_API_KEY");
    }

    const { email }: PublicPasswordResetRequest = await req.json();

    // Return 200 even if email is missing to avoid leaking details.
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

    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: 'https://sealogg.se/portal/reset-password' },
    });

    // Use token_hash approach to bypass Supabase redirect URL allowlist
    const hashedToken = linkData?.properties?.hashed_token;

    // If we can't generate a link (e.g. email doesn't exist), still return 200.
    if (!hashedToken) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resetLink = `https://sealogg.se/portal/reset-password?token_hash=${hashedToken}&type=recovery`;

    const res = await fetch("https://api.resend.com/emails", {
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
              .logo { font-size: 24px; font-weight: bold; color: #0077b6; }
              .content { padding: 30px 0; }
              .button { display: inline-block; padding: 14px 28px; background-color: #0077b6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
              .footer { padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">SeaLogg</div>
              </div>
              <div class="content">
                <h2>Återställ lösenord</h2>
                <p>Klicka på knappen nedan för att välja ett nytt lösenord:</p>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${resetLink}" class="button" style="color: white;">Återställ lösenord</a>
                </p>
                <p><small>Om du inte begärt detta kan du ignorera detta mail.</small></p>
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

    // Even if Resend fails, return 200 (avoid leaking details). Log for debugging.
    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("public-password-reset error:", error);

    // Still return 200 (avoid account enumeration + keep UX consistent)
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
