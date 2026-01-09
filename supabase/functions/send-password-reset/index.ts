import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify requesting user is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', { 
      _user_id: requestingUser.id, 
      _role: 'admin' 
    });
    
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Not authorized - admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, userName } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate password reset link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    if (linkError) {
      return new Response(JSON.stringify({ error: linkError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resetLink = linkData.properties?.action_link;
    
    if (!resetLink) {
      return new Response(JSON.stringify({ error: "Failed to generate reset link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send email via Resend
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
                <div class="logo">⚓ SeaLogg</div>
              </div>
              <div class="content">
                <h2>Hej${userName ? ` ${userName}` : ''}!</h2>
                <p>Du har bett om att återställa ditt lösenord för SeaLogg.</p>
                <p>Klicka på knappen nedan för att välja ett nytt lösenord:</p>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${resetLink}" class="button" style="color: white;">Återställ lösenord</a>
                </p>
                <p><small>Om du inte begärt detta kan du ignorera detta mail. Länken är giltig i 24 timmar.</small></p>
              </div>
              <div class="footer">
                <p>Med vänliga hälsningar,<br>SeaLogg-teamet</p>
                <p>SeaLogg - Digital Fartygsloggbok<br>En del av AhrensGroup AB</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const emailResponse = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", emailResponse);
      throw new Error(emailResponse.message || "Failed to send email");
    }

    console.log("Password reset email sent:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Password reset email sent successfully" 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
