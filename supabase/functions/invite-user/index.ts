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
    const { email, fullName, organizationId, role } = await req.json();

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
      
      // Ensure profile exists for existing user
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (!existingProfile) {
        // Create profile for existing user if missing
        await supabaseAdmin
          .from('profiles')
          .insert({
            user_id: userId,
            full_name: fullName,
            email: email,
          });
      }
    } else {
      isNewUser = true;
      // Create new user with a temporary password
      const tempPassword = crypto.randomUUID();
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
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

      // Create profile for new user
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: userId,
          full_name: fullName,
          email: email,
        });

      if (profileError) {
        console.error("Failed to create profile:", profileError);
      }

      // Generate password reset link
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: `${APP_URL}/portal/reset-password`,
        },
      });

      if (linkError) {
        console.error("Failed to generate reset link:", linkError);
      } else {
        const resetLink = linkData.properties?.action_link;
        
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
          } else {
            console.log("Welcome email sent successfully:", emailResponse);
          }
        } else {
          console.error("Missing reset link or RESEND_API_KEY");
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