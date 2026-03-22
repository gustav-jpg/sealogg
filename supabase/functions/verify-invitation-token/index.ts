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
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token krävs" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up the invitation token
    const { data: invitation, error: lookupError } = await supabaseAdmin
      .from("invitation_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (lookupError || !invitation) {
      return new Response(JSON.stringify({ error: "Ogiltig länk" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already used
    if (invitation.used_at) {
      return new Response(JSON.stringify({ error: "Länken har redan använts" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Länken har utgått" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a fresh Supabase recovery link (short-lived, but created on-demand)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: invitation.user_email,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("Failed to generate recovery link:", linkError);
      return new Response(JSON.stringify({ error: "Kunde inte skapa återställningslänk" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark the invitation token as used
    await supabaseAdmin
      .from("invitation_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invitation.id);

    // Return the fresh token_hash for the client to use with verifyOtp
    return new Response(
      JSON.stringify({
        token_hash: linkData.properties.hashed_token,
        type: "recovery",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
