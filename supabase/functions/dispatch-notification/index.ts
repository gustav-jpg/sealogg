import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Centralized notification dispatcher.
 * Accepts a notification event, checks user preferences, and sends
 * push notifications and/or emails accordingly.
 *
 * Payload:
 * {
 *   event: "fault_comment" | "fault_assigned" | "new_fault" | "new_deviation",
 *   organization_id: string,
 *   // For fault_comment: mentioned user_ids parsed from @mentions
 *   recipient_user_ids?: string[],
 *   // For fault_assigned: the assigned user
 *   assigned_user_id?: string,
 *   // Context
 *   fault_case_id?: string,
 *   deviation_id?: string,
 *   title: string,
 *   body: string,
 *   url?: string,
 *   commenter_name?: string,
 *   vessel_name?: string,
 * }
 */

interface NotifyPayload {
  event: "fault_comment" | "fault_assigned" | "new_fault" | "new_deviation";
  organization_id: string;
  recipient_user_ids?: string[];
  assigned_user_id?: string;
  fault_case_id?: string;
  deviation_id?: string;
  title: string;
  body: string;
  url?: string;
  commenter_name?: string;
  vessel_name?: string;
}

// Maps event types to preference column names
const PREF_MAP: Record<string, { email: string; push: string }> = {
  fault_comment: { email: "email_fault_comment", push: "push_fault_comment" },
  fault_assigned: { email: "email_fault_assigned", push: "push_fault_assigned" },
  new_fault: { email: "email_new_faults", push: "push_new_faults" },
  new_deviation: { email: "email_new_deviations", push: "push_new_deviations" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload: NotifyPayload = await req.json();

    console.log("[notify] Event:", payload.event, "Org:", payload.organization_id);

    const prefColumns = PREF_MAP[payload.event];
    if (!prefColumns) {
      return new Response(JSON.stringify({ error: "Unknown event type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine target user IDs
    let targetUserIds: string[] = [];

    if (payload.recipient_user_ids && payload.recipient_user_ids.length > 0) {
      targetUserIds = payload.recipient_user_ids;
    } else if (payload.assigned_user_id) {
      targetUserIds = [payload.assigned_user_id];
    } else {
      // For new_fault / new_deviation: get all users in org with preferences
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("user_id")
        .eq("organization_id", payload.organization_id);

      if (prefs) {
        targetUserIds = prefs.map((p: { user_id: string }) => p.user_id);
      }
    }

    if (targetUserIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "No target users", push_sent: 0, email_sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch preferences for target users
    const { data: userPrefs } = await supabase
      .from("notification_preferences")
      .select("user_id, " + prefColumns.email + ", " + prefColumns.push)
      .eq("organization_id", payload.organization_id)
      .in("user_id", targetUserIds);

    // Build maps: who wants push, who wants email
    const wantsPush: string[] = [];
    const wantsEmail: string[] = [];

    for (const uid of targetUserIds) {
      const pref = userPrefs?.find((p: Record<string, unknown>) => p.user_id === uid);
      // Default to true if no preference row exists
      const emailEnabled = pref ? (pref as Record<string, unknown>)[prefColumns.email] !== false : true;
      const pushEnabled = pref ? (pref as Record<string, unknown>)[prefColumns.push] !== false : true;

      if (pushEnabled) wantsPush.push(uid);
      if (emailEnabled) wantsEmail.push(uid);
    }

    let pushSent = 0;
    let emailSent = 0;

    // ── Send push notifications ──
    if (wantsPush.length > 0) {
      try {
        const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            user_ids: wantsPush,
            title: payload.title,
            body: payload.body,
            tag: payload.event,
            url: payload.url || "/portal/fault-cases",
          }),
        });

        const pushResult = await pushResponse.json();
        pushSent = pushResult.sent || 0;
        console.log(`[notify] Push sent: ${pushSent}`);
      } catch (e) {
        console.error("[notify] Push error:", e);
      }
    }

    // ── Send emails ──
    if (wantsEmail.length > 0 && resendApiKey) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", wantsEmail)
        .not("email", "is", null);

      if (profiles && profiles.length > 0) {
        const portalUrl = payload.url
          ? `https://sealogg.lovable.app${payload.url}`
          : "https://sealogg.lovable.app/portal/fault-cases";

        const emailSubject = payload.title;
        const emailHtml = buildEmailHtml(payload, portalUrl);

        for (const profile of profiles) {
          if (!profile.email) continue;
          try {
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify({
                from: "Sealogg <noreply@sealogg.se>",
                to: [profile.email],
                subject: emailSubject,
                html: emailHtml,
              }),
            });

            if (res.ok) {
              emailSent++;
              await supabase.from("notification_logs").insert({
                user_id: profile.user_id,
                notification_type: "email",
                category: payload.event,
                subject: emailSubject,
                body: payload.body,
                status: "sent",
                sent_at: new Date().toISOString(),
                organization_id: payload.organization_id,
                reference_table: payload.fault_case_id ? "fault_cases" : "deviations",
                reference_id: payload.fault_case_id || payload.deviation_id || null,
              });
            }
          } catch (err) {
            console.error("[notify] Email error:", err);
          }
        }
      }
    }

    console.log(`[notify] Done. Push: ${pushSent}, Email: ${emailSent}`);

    return new Response(
      JSON.stringify({ message: "Notifications dispatched", push_sent: pushSent, email_sent: emailSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[notify] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildEmailHtml(payload: NotifyPayload, portalUrl: string): string {
  const eventLabels: Record<string, { emoji: string; heading: string; color: string }> = {
    fault_comment: { emoji: "💬", heading: "Ny kommentar i felärende", color: "#0ea5e9" },
    fault_assigned: { emoji: "👤", heading: "Du har tilldelats ett felärende", color: "#8b5cf6" },
    new_fault: { emoji: "🔧", heading: "Nytt felärende", color: "#0f172a" },
    new_deviation: { emoji: "⚠️", heading: "Ny avvikelse", color: "#7c3aed" },
  };

  const meta = eventLabels[payload.event] || { emoji: "🔔", heading: "Notifikation", color: "#0f172a" };

  // Build detail rows for the info table
  let detailRows = "";

  if (payload.vessel_name) {
    detailRows += `
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  <span style="color: #64748b; font-size: 14px;">Fartyg</span>
                </td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                  <span style="color: #0f172a; font-size: 14px; font-weight: 500;">${payload.vessel_name}</span>
                </td>
              </tr>`;
  }

  if (payload.commenter_name) {
    const roleLabel = payload.event === "fault_assigned" ? "Tilldelad av" : "Av";
    detailRows += `
              <tr>
                <td style="padding: 10px 0;">
                  <span style="color: #64748b; font-size: 14px;">${roleLabel}</span>
                </td>
                <td style="padding: 10px 0; text-align: right;">
                  <span style="color: #0f172a; font-size: 14px; font-weight: 500;">${payload.commenter_name}</span>
                </td>
              </tr>`;
  }

  const detailTable = detailRows
    ? `<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">${detailRows}</table>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
      <h2>${meta.emoji} ${meta.heading}</h2>
      
      <div class="info-box">
        <strong>${payload.title}</strong><br>
        ${payload.body}
        ${payload.vessel_name ? `<br><br><strong>Fartyg:</strong> ${payload.vessel_name}` : ""}
        ${payload.commenter_name ? `<br><strong>${payload.event === "fault_assigned" ? "Tilldelad av" : "Av"}:</strong> ${payload.commenter_name}` : ""}
      </div>
      
      <p style="text-align: center; margin: 30px 0;">
        <a href="${portalUrl}" class="button" style="color: white;">Visa i SeaLogg</a>
      </p>
    </div>
    <div class="footer">
      <p>Du kan ändra dina notifikationsinställningar i SeaLogg under Inställningar.</p>
      <p>Med vänliga hälsningar,<br>SeaLogg-teamet</p>
      <p>SeaLogg - Digital Fartygsloggbok<br>En del av AhrensGroup AB</p>
    </div>
  </div>
</body>
</html>`;
}
