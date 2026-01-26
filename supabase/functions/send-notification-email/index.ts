import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  user_id?: string;
  user_ids?: string[];
  email?: string;
  emails?: string[];
  subject: string;
  html: string;
  category: string;
  reference_table?: string;
  reference_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: EmailPayload = await req.json();

    // Collect email addresses
    let emails: string[] = [];
    let userIds: string[] = [];

    if (payload.emails) {
      emails = payload.emails;
    } else if (payload.email) {
      emails = [payload.email];
    }

    if (payload.user_ids) {
      userIds = payload.user_ids;
    } else if (payload.user_id) {
      userIds = [payload.user_id];
    }

    // Fetch emails from user IDs if needed
    if (userIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, email")
        .in("user_id", userIds)
        .not("email", "is", null);

      if (profileError) throw profileError;

      if (profiles) {
        emails = [...emails, ...profiles.map((p: { email: string }) => p.email).filter(Boolean)];
      }
    }

    if (emails.length === 0) {
      return new Response(
        JSON.stringify({ message: "No email addresses found", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Remove duplicates
    emails = [...new Set(emails)];

    // Send emails using Resend API directly
    const results = await Promise.allSettled(
      emails.map(async (email) => {
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
              from: "Sealogg <noreply@sealogg.se>",
              to: [email],
              subject: payload.subject,
              html: payload.html
            })
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.message || "Failed to send email");
          }

          // Log notification
          await supabase.from("notification_logs").insert({
            notification_type: "email",
            category: payload.category,
            subject: payload.subject,
            body: payload.html,
            status: "sent",
            sent_at: new Date().toISOString(),
            reference_table: payload.reference_table,
            reference_id: payload.reference_id
          });

          return true;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error("Email error:", email, error);
          
          await supabase.from("notification_logs").insert({
            notification_type: "email",
            category: payload.category,
            subject: payload.subject,
            body: payload.html,
            status: "failed",
            error_message: errorMessage
          });

          return false;
        }
      })
    );

    const sent = results.filter(r => r.status === "fulfilled" && r.value).length;

    return new Response(
      JSON.stringify({ message: "Emails processed", sent, total: emails.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("Error in send-notification-email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
