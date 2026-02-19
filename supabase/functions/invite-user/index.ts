import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Public app URL used in emails (where users should land after verifying the token)
const APP_URL = "https://sealogg.se";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get the requesting user's token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the requesting user is a superadmin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if requesting user is superadmin
    console.log("Checking superadmin for user:", requestingUser.id);
    const { data: isSuperadmin, error: rpcError } = await supabaseAdmin.rpc('is_superadmin', { _user_id: requestingUser.id });
    console.log("Superadmin check result:", isSuperadmin, "Error:", rpcError);
    
    if (rpcError) {
      console.error("RPC Error:", rpcError);
      return new Response(JSON.stringify({ error: "Error checking permissions: " + rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    if (!isSuperadmin) {
      return new Response(JSON.stringify({ error: "Not authorized - not a superadmin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { email, fullName, organizationId, role, initialPassword } = await req.json();

    if (!email || !fullName || !organizationId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get organization name for the email
    const { data: orgData } = await supabaseAdmin
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single();
    const organizationName = orgData?.name || 'din organisation';

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      userId = existingUser.id;

      // Do NOT overwrite existing user's profile name/data
      // Just proceed to add them to the organization

      // Send "added to organization" email to existing user
      if (RESEND_API_KEY) {
        const roleText = role === 'org_admin' ? 'administratör' : 'användare';
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "SeaLogg <noreply@sealogg.se>",
              to: [email],
              subject: `Du har lagts till i ${organizationName} - SeaLogg`,
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
                    .info-box { background-color: #f0f9ff; border-left: 4px solid #0077b6; padding: 15px; margin: 20px 0; }
                    .footer { padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <img src="https://sealogg.se/sealog-logo.png" alt="SeaLogg" style="height: 50px; width: auto;" />
                    </div>
                    <div class="content">
                      <h2>Hej ${fullName}!</h2>
                      <p>Du har lagts till som <strong>${roleText}</strong> i <strong>${organizationName}</strong> på SeaLogg.</p>
                      
                      <div class="info-box">
                        <strong>Ditt konto:</strong><br>
                        Organisation: ${organizationName}<br>
                        Roll: ${roleText}
                      </div>
                      
                      <p>Du kan logga in med ditt befintliga konto:</p>
                      
                      <p style="text-align: center; margin: 30px 0;">
                        <a href="https://sealogg.se/portal/login" class="button" style="color: white;">Logga in</a>
                      </p>
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

          if (!res.ok) {
            const err = await res.text();
            console.error("Failed to send org-added email:", err);
          } else {
            console.log("Org-added email sent to existing user:", email);
          }
        } catch (emailErr) {
          console.error("Exception sending org-added email:", emailErr);
        }
      }
    } else {
      isNewUser = true;
      
      // Use admin-provided password or generate temporary one
      const useInitialPassword = initialPassword && initialPassword.length >= 6;
      const passwordToUse = useInitialPassword ? initialPassword : crypto.randomUUID();
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: passwordToUse,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (createError || !newUser.user) {
        return new Response(JSON.stringify({ error: createError?.message || "Failed to create user" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = newUser.user.id;

      // Upsert profile for new user (required)
      // If admin set password, flag must_change_password
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert(
          {
            user_id: userId,
            full_name: fullName,
            email: email,
            is_external: false,
            organization_id: organizationId,
            must_change_password: useInitialPassword,
          },
          { onConflict: 'user_id' }
        );

      if (profileError) {
        console.error("Failed to upsert profile (required):", profileError);
        return new Response(JSON.stringify({
          error: "Failed to create user profile",
          details: profileError.message,
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate password reset link
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: `${APP_URL}/portal/reset-password`,
        },
      });

      // Skip email if admin set a password - user will login directly
      if (useInitialPassword) {
        console.log("Admin set password, skipping welcome email");
      } else if (linkError) {
        console.error("Failed to generate reset link:", linkError);
        return new Response(JSON.stringify({
          error: "Failed to generate password setup link",
          details: linkError.message,
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        const resetLink = linkData.properties?.action_link;

        if (!resetLink) {
          console.error("Missing reset link in generateLink response");
          return new Response(JSON.stringify({ error: "Missing reset link" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!RESEND_API_KEY) {
          console.error("RESEND_API_KEY is not configured");
          return new Response(JSON.stringify({ error: "RESEND_API_KEY is not configured" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (resetLink && RESEND_API_KEY) {
          // Send welcome email with password setup link via Resend
          const roleText = role === 'org_admin' ? 'administratör' : 'användare';
          
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "SeaLogg <noreply@sealogg.se>",
              to: [email],
              subject: `Välkommen till SeaLogg - ${organizationName}`,
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
                    .info-box { background-color: #f0f9ff; border-left: 4px solid #0077b6; padding: 15px; margin: 20px 0; }
                    .footer { padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <img src="https://sealogg.se/sealog-logo.png" alt="SeaLogg" style="height: 50px; width: auto;" />
                    </div>
                    <div class="content">
                      <h2>Välkommen ${fullName}!</h2>
                      <p>Du har lagts till som <strong>${roleText}</strong> i <strong>${organizationName}</strong> på SeaLogg.</p>
                      
                      <div class="info-box">
                        <strong>Ditt konto:</strong><br>
                        E-post: ${email}<br>
                        Organisation: ${organizationName}<br>
                        Roll: ${roleText}
                      </div>
                      
                      <p>För att komma igång behöver du sätta ett lösenord för ditt konto:</p>
                      
                      <p style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" class="button" style="color: white;">Skapa ditt lösenord</a>
                      </p>
                      
                      <p><small>Länken är giltig i 24 timmar. Om du inte förväntade dig detta mail kan du ignorera det.</small></p>
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
            return new Response(JSON.stringify({
              error: "Failed to send welcome email",
              details: emailResponse,
            }), {
              status: 502,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } else {
            console.log("Welcome email sent successfully:", emailResponse);
          }
        }
      }
    }

    // Check if already a member of this organization
    const { data: existingMember } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMember) {
      return new Response(JSON.stringify({ error: "User is already a member of this organization" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add user to organization
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        role: role || 'org_admin',
      });

    if (memberError) {
      return new Response(JSON.stringify({ error: memberError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      userId,
      isNewUser,
      message: isNewUser 
        ? "Ny användare skapad! De får ett e-postmeddelande för att sätta lösenord." 
        : "Befintlig användare tillagd i organisationen."
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