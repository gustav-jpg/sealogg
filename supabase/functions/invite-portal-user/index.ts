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

    // Get the requesting user's token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the requesting user
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
    const { email, fullName, role, organizationId } = await req.json();

    if (!email || !fullName || !role || !organizationId) {
      return new Response(JSON.stringify({ error: "Missing required fields: email, fullName, role, organizationId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate role
    const validRoles = ['admin', 'skeppare', 'readonly'];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      userId = existingUser.id;
      
      // Check if user already has this role
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', role)
        .maybeSingle();
      
      if (existingRole) {
        return new Response(JSON.stringify({ error: "User already has this role" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
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
      isNewUser = true;
      console.log("New user created with ID:", userId);

      // Generate password reset link
      console.log("Generating password reset link for:", email);
      let resetLink: string | null = null;
      
      const { data: linkData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
      });

      if (resetError) {
        console.error("Failed to generate reset link:", resetError);
      } else if (linkData?.properties?.action_link) {
        resetLink = linkData.properties.action_link;
        console.log("Reset link generated successfully");
      }
      
      console.log("RESEND_API_KEY available:", !!RESEND_API_KEY);
      
      // ALWAYS send welcome email for new users
      if (RESEND_API_KEY) {
        const roleText = role === 'admin' ? 'administratör' : role === 'skeppare' ? 'skeppare' : 'läsare';
        
        // Build email HTML - include reset button only if link was generated
        const resetButtonHtml = resetLink 
          ? `<p style="text-align: center; margin: 30px 0;">
               <a href="${resetLink}" class="button" style="color: white;">Sätt lösenord</a>
             </p>
             <p><small>Länken är giltig i 24 timmar.</small></p>`
          : `<p>Kontakta din administratör för att få ett lösenord.</p>`;
        
        console.log("Sending welcome email to:", email);
        
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
                      <div class="logo">SeaLogg</div>
                    </div>
                    <div class="content">
                      <h2>Välkommen till SeaLogg, ${fullName}!</h2>
                      <p>Du har bjudits in till SeaLogg som <strong>${roleText}</strong>.</p>
                      <p>Klicka på knappen nedan för att sätta ditt lösenord och aktivera ditt konto:</p>
                      ${resetButtonHtml}
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
            console.error("Failed to send welcome email via Resend:", err);
          } else {
            const emailResult = await res.json();
            console.log("Welcome email sent successfully:", emailResult);
          }
        } catch (emailError) {
          console.error("Exception sending email:", emailError);
        }
      } else {
        console.error("RESEND_API_KEY is not configured - cannot send welcome email");
      }
    }

    // Add role to user
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: role,
      });

    if (roleError) {
      return new Response(JSON.stringify({ error: roleError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add user to the specific organization
    const { error: orgError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        role: 'org_user',
      });
    
    if (orgError && !orgError.message.includes('duplicate')) {
      console.error("Failed to add to organization:", orgError);
    }

    // Ensure the user's profile exists and is scoped to the organization.
    // NOTE: When creating users via admin API, the automatic profile trigger may not always
    // populate the public profile as expected, so we upsert here to guarantee visibility.
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          full_name: fullName,
          email: email,
          is_external: false,
          organization_id: organizationId,
        },
        { onConflict: 'user_id' }
      );

    if (profileError) {
      console.error("Failed to upsert profile:", profileError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      userId,
      isNewUser,
      message: isNewUser 
        ? "Ny användare skapad. Ett välkomstmail har skickats." 
        : "Roll tillagd till befintlig användare."
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
