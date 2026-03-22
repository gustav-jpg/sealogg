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

    const { token, otp_code, email } = await req.json();

    // Support two modes: token-based (link click) or OTP-based (manual code entry)
    let invitation;

    if (otp_code && email) {
      // OTP mode: look up by email + code
      const { data, error } = await supabaseAdmin
        .from("invitation_tokens")
        .select("*")
        .eq("user_email", email.toLowerCase().trim())
        .eq("otp_code", otp_code.trim())
        .is("used_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Felaktig kod. Kontrollera koden och e-postadressen." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      invitation = data;
    } else if (token) {
      // Token mode: look up by UUID token (link click)
      const { data, error } = await supabaseAdmin
        .from("invitation_tokens")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Ogiltig länk" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      invitation = data;
    } else {
      return new Response(JSON.stringify({ error: "Token eller kod krävs" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already used
    if (invitation.used_at) {
      return new Response(JSON.stringify({ error: "Koden/länken har redan använts" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Koden/länken har utgått. Begär en ny." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a fresh Supabase recovery link
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
