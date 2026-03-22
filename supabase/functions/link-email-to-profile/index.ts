import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Public app URL used in emails (where users should land after verifying the token)
const APP_URL = "https://sealogg.se";

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

    // Verify requesting user
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

    // Check if requesting user is admin
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

    // Parse request body
    const { profileId, email, role, organizationId } = await req.json();

    if (!profileId || !email || !organizationId) {
      return new Response(JSON.stringify({ error: "Missing required fields: profileId, email, organizationId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the external profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!profile.is_external) {
      return new Response(JSON.stringify({ error: "Profile is not external - already has login" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (profile.user_id) {
      return new Response(JSON.stringify({ error: "Profile already linked to a user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if email is already used
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    if (existingUser) {
      return new Response(JSON.stringify({ error: "This email is already registered" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create new auth user
    const tempPassword = crypto.randomUUID();
    
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: profile.full_name },
    });

    if (createError || !newUser.user) {
      return new Response(JSON.stringify({ error: createError?.message || "Failed to create user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete the auto-created profile (from the trigger)
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', newUser.user.id);

    // Update the external profile to link to the new user
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        user_id: newUser.user.id,
        email: email,
        is_external: false 
      })
      .eq('id', profileId);

    if (updateError) {
      // Rollback: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add role if specified
    if (role) {
      const validRoles = ['admin', 'skeppare', 'readonly'];
      if (validRoles.includes(role)) {
        await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: newUser.user.id,
            role: role,
          });
      }
    }

    // Add to the specific organization
    const { error: orgError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: organizationId,
        user_id: newUser.user.id,
        role: 'org_user',
      });
    
    if (orgError && !orgError.message.includes('duplicate')) {
      console.error("Failed to add to organization:", orgError);
    }

    // Generate a custom invitation token valid for 7 days with OTP code
    const inviteToken = crypto.randomUUID();
    const otpCode = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error: tokenError } = await supabaseAdmin
      .from('invitation_tokens')
      .insert({
        token: inviteToken,
        user_email: email,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error("Failed to create invitation token:", tokenError);
      return new Response(JSON.stringify({
        error: "Failed to create invitation token",
        details: tokenError.message,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resetLink = `${APP_URL}/portal/reset-password?invite_token=${inviteToken}`;

    if (RESEND_API_KEY) {
      
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "SeaLogg <noreply@sealogg.se>",
          to: [email],
          subject: "Välkommen till SeaLogg - Sätt ditt lösenord",
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
                  <img src="https://sealogg.se/sealog-logo.png" alt="SeaLogg" style="height: 50px; width: auto;" />
                </div>
                <div class="content">
                  <h2>Välkommen till SeaLogg, ${profile.full_name}!</h2>
                  <p>Ditt konto har aktiverats med e-postadressen <strong>${email}</strong>.</p>
                   <p>Klicka på knappen nedan för att sätta ditt lösenord:</p>
                   <p style="text-align: center; margin: 30px 0;">
                     <a href="${resetLink}" class="button" style="color: white;">Sätt lösenord</a>
                   </p>
                   <div style="text-align: center; color: #999; margin: 20px 0; font-size: 13px;">─── Fungerar inte länken? Använd koden nedan ───</div>
                   <div style="background-color: #f0f9ff; border: 2px dashed #0077b6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                     <p style="margin: 0 0 10px; font-size: 14px; color: #666;">Din engångskod:</p>
                     <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0077b6; font-family: monospace;">${otpCode}</div>
                   </div>
                   <p style="font-size: 13px; color: #666; text-align: center;">Ange koden på <a href="https://sealogg.se/portal/reset-password">sealogg.se/portal/reset-password</a> tillsammans med din e-postadress.</p>
                   <p><small>Länken och koden är giltiga i 7 dagar.</small></p>
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

      if (!res.ok) {
        const err = await res.text();
        console.error("Failed to send email via Resend:", err);
      } else {
        console.log("Welcome email sent via Resend");
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      userId: newUser.user.id,
      message: "E-post kopplad till profil. Användaren får ett mail för att sätta lösenord."
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
