import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's auth to verify they're authenticated
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callingUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !callingUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if calling user is admin
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: isAdmin } = await adminClient.rpc('is_admin_or_skeppare', { 
      _user_id: callingUser.id 
    });
    
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { profileId, userId } = await req.json();

    if (!profileId) {
      return new Response(JSON.stringify({ error: "Profile ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Deleting user - profileId: ${profileId}, userId: ${userId}`);

    // Delete the profile first (this will cascade to related data)
    const { error: profileError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', profileId);

    if (profileError) {
      console.error('Error deleting profile:', profileError);
      throw new Error(`Failed to delete profile: ${profileError.message}`);
    }

    // If user has an auth account, delete it
    if (userId) {
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);
      
      if (authDeleteError) {
        console.error('Error deleting auth user:', authDeleteError);
        // Profile is already deleted, log but don't fail
        console.warn(`Profile deleted but auth user deletion failed: ${authDeleteError.message}`);
      } else {
        console.log(`Successfully deleted auth user: ${userId}`);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in delete-user function:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
