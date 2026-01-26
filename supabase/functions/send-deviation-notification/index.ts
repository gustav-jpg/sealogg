import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeviationPayload {
  deviation_id: string;
  title: string;
  description: string;
  type: string;
  severity: string;
  vessel_id: string;
  created_by: string;
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

    const payload: DeviationPayload = await req.json();
    console.log("Received deviation notification payload:", payload);

    // Get vessel info and organization
    const { data: vessel, error: vesselError } = await supabase
      .from("vessels")
      .select("name, organization_id")
      .eq("id", payload.vessel_id)
      .single();

    if (vesselError || !vessel) {
      console.error("Vessel not found:", vesselError);
      return new Response(JSON.stringify({ error: "Vessel not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get creator name
    const { data: creator } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", payload.created_by)
      .single();

    // Find admins who want deviation notifications
    const { data: preferences, error: prefError } = await supabase
      .from("notification_preferences")
      .select("user_id")
      .eq("organization_id", vessel.organization_id)
      .eq("email_new_deviations", true);

    if (prefError) {
      console.error("Error fetching preferences:", prefError);
      throw prefError;
    }

    if (!preferences || preferences.length === 0) {
      console.log("No users opted in for deviation notifications");
      return new Response(JSON.stringify({ message: "No recipients", sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get emails for these users
    const userIds = preferences.map(p => p.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email")
      .in("user_id", userIds)
      .not("email", "is", null);

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No email addresses", sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const typeLabels: Record<string, string> = {
      incident_with_accident: "Incident (med tillbud)",
      incident_without_accident: "Incident (utan tillbud)",
      observation: "Observation",
      improvement: "Förbättringsförslag",
    };

    const severityLabels: Record<string, string> = {
      low: "Låg",
      medium: "Medel",
      high: "Hög",
      critical: "Kritisk",
    };

    const severityColors: Record<string, string> = {
      low: "#22c55e",
      medium: "#f59e0b",
      high: "#ef4444",
      critical: "#dc2626",
    };

    const typeLabel = typeLabels[payload.type] || payload.type;
    const severityLabel = severityLabels[payload.severity] || payload.severity;
    const severityColor = severityColors[payload.severity] || "#6b7280";

    const portalUrl = "https://sealogg.lovable.app/portal/deviations";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">⚠️ Ny avvikelse</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <h2 style="margin: 0 0 10px 0; color: #0f172a; font-size: 18px;">${payload.title}</h2>
              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">${payload.description}</p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  <span style="color: #64748b; font-size: 14px;">Fartyg</span>
                </td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                  <span style="color: #0f172a; font-size: 14px; font-weight: 500;">${vessel.name}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  <span style="color: #64748b; font-size: 14px;">Typ</span>
                </td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                  <span style="color: #0f172a; font-size: 14px; font-weight: 500;">${typeLabel}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  <span style="color: #64748b; font-size: 14px;">Allvarlighetsgrad</span>
                </td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                  <span style="background: ${severityColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500;">${severityLabel}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0;">
                  <span style="color: #64748b; font-size: 14px;">Rapporterad av</span>
                </td>
                <td style="padding: 10px 0; text-align: right;">
                  <span style="color: #0f172a; font-size: 14px; font-weight: 500;">${creator?.full_name || "Okänd"}</span>
                </td>
              </tr>
            </table>
            
            <div style="text-align: center; margin-top: 25px;">
              <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                Visa i Sealogg
              </a>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              Du får detta mail för att du har aktiverat notifieringar för nya avvikelser.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send emails
    const emails = profiles.map(p => p.email).filter(Boolean);
    let sent = 0;

    for (const email of emails) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Sealogg <noreply@sealogg.se>",
            to: [email],
            subject: `⚠️ Ny avvikelse: ${payload.title}`,
            html: emailHtml,
          }),
        });

        if (response.ok) {
          sent++;
          await supabase.from("notification_logs").insert({
            notification_type: "email",
            category: "new_deviation",
            subject: `Ny avvikelse: ${payload.title}`,
            body: emailHtml,
            status: "sent",
            sent_at: new Date().toISOString(),
            reference_table: "deviations",
            reference_id: payload.deviation_id,
            organization_id: vessel.organization_id,
          });
        }
      } catch (err) {
        console.error("Email send error:", err);
      }
    }

    console.log(`Sent ${sent} deviation notification emails`);

    return new Response(JSON.stringify({ message: "Notifications sent", sent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-deviation-notification:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
