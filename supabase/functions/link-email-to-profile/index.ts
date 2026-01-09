import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { profileId, email, role } = await req.json();

    if (!profileId || !email) {
      return new Response(JSON.stringify({ error: "Missing required fields: profileId, email" }), {
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

    // Add to same organizations as the admin
    const { data: adminOrgs } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', requestingUser.id);

    if (adminOrgs && adminOrgs.length > 0) {
      for (const org of adminOrgs) {
        const { error: orgError } = await supabaseAdmin
          .from('organization_members')
          .insert({
            organization_id: org.organization_id,
            user_id: newUser.user.id,
            role: 'org_user',
          });
        
        if (orgError && !orgError.message.includes('duplicate')) {
          console.error("Failed to add to organization:", orgError);
        }
      }
    }

    // Send password reset email
    const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    if (resetError) {
      console.error("Failed to send reset email:", resetError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      userId: newUser.user.id,
      message: "Email linked to profile. User will receive a password reset email."
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
