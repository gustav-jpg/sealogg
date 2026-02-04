import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DigestData {
  expiringCertificates: Array<{
    userName: string;
    certificateName: string;
    expiryDate: string;
    daysLeft: number;
  }>;
  expiringControls: Array<{
    controlName: string;
    vesselName: string;
    dueDate: string;
    daysLeft: number;
  }>;
  newDeviations: Array<{
    title: string;
    vesselName: string;
    severity: string;
    createdAt: string;
  }>;
  openFaults: Array<{
    title: string;
    vesselName: string;
    priority: string;
    createdAt: string;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured, skipping digest");
      return new Response(
        JSON.stringify({ message: "RESEND_API_KEY not configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse frequency from request (daily or weekly)
    let frequency = "daily";
    try {
      const body = await req.json();
      frequency = body.frequency || "daily";
    } catch {
      // Default to daily if no body
    }

    console.log(`Running ${frequency} digest`);

    // Get all users with digest enabled and matching frequency
    const { data: preferences, error: prefError } = await supabase
      .from("notification_preferences")
      .select(`
        user_id,
        organization_id,
        days_before_warning,
        email_expiring_certificates,
        email_expiring_controls,
        email_new_deviations,
        email_new_faults
      `)
      .eq("email_daily_digest", true)
      .eq("digest_frequency", frequency);

    if (prefError) {
      throw prefError;
    }

    if (!preferences || preferences.length === 0) {
      console.log("No users with digest enabled");
      return new Response(
        JSON.stringify({ message: "No users with digest enabled", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const now = new Date();
    const lookbackDays = frequency === "weekly" ? 7 : 1;
    const lookbackDate = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

    let sentCount = 0;

    for (const pref of preferences) {
      try {
        // Get user email
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("user_id", pref.user_id)
          .single();

        if (!profile?.email) continue;

        const digestData: DigestData = {
          expiringCertificates: [],
          expiringControls: [],
          newDeviations: [],
          openFaults: [],
        };

        const warningDate = new Date(now.getTime() + pref.days_before_warning * 24 * 60 * 60 * 1000).toISOString();

        // Fetch expiring AND expired certificates
        if (pref.email_expiring_certificates) {
          const { data: certs } = await supabase
            .from("user_certificates")
            .select(`
              expiry_date,
              profiles!inner(full_name, organization_id),
              certificate_types(name)
            `)
            .eq("profiles.organization_id", pref.organization_id)
            .lte("expiry_date", warningDate); // Include all certificates that have expired or will expire within warning period

          if (certs) {
            digestData.expiringCertificates = certs.map((c: any) => ({
              userName: c.profiles?.full_name || "Okänd",
              certificateName: c.certificate_types?.name || "Okänt certifikat",
              expiryDate: new Date(c.expiry_date).toLocaleDateString("sv-SE"),
              daysLeft: Math.ceil((new Date(c.expiry_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
            }));
          }
        }

        // Fetch expiring controls
        if (pref.email_expiring_controls) {
          const { data: controls } = await supabase
            .from("control_points")
            .select(`
              id,
              name,
              interval_months,
              control_point_records(performed_at),
              control_point_vessels(vessel_id, vessels(name))
            `)
            .eq("organization_id", pref.organization_id)
            .eq("is_active", true)
            .eq("type", "calendar");

          if (controls) {
            for (const control of controls) {
              if (!control.interval_months) continue;
              
              const latestRecord = control.control_point_records
                ?.sort((a: any, b: any) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime())[0];
              
              if (latestRecord) {
                const nextDue = new Date(latestRecord.performed_at);
                nextDue.setMonth(nextDue.getMonth() + control.interval_months);
                
                if (nextDue <= new Date(warningDate) && nextDue >= now) {
                  const vesselNames = control.control_point_vessels
                    ?.map((v: any) => v.vessels?.name)
                    .filter(Boolean)
                    .join(", ") || "Alla fartyg";
                  
                  digestData.expiringControls.push({
                    controlName: control.name,
                    vesselName: vesselNames,
                    dueDate: nextDue.toLocaleDateString("sv-SE"),
                    daysLeft: Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
                  });
                }
              }
            }
          }
        }

        // Get vessels for this organization once (used for deviations and faults)
        let orgVesselIds: string[] = [];
        if (pref.email_new_deviations || pref.email_new_faults) {
          const { data: orgVessels } = await supabase
            .from("vessels")
            .select("id")
            .eq("organization_id", pref.organization_id);
          orgVesselIds = orgVessels?.map(v => v.id) || [];
        }

        // Fetch new deviations - MUST filter by vessels in user's organization
        if (pref.email_new_deviations && orgVesselIds.length > 0) {
          const { data: deviations } = await supabase
            .from("deviations")
            .select(`
              title,
              severity,
              created_at,
              vessels(name)
            `)
            .in("vessel_id", orgVesselIds)
            .gte("created_at", lookbackDate)
            .order("created_at", { ascending: false });

          if (deviations) {
            digestData.newDeviations = deviations.map((d: any) => ({
              title: d.title,
              vesselName: d.vessels?.name || "Okänt fartyg",
              severity: d.severity === "hog" ? "Hög" : d.severity === "medel" ? "Medel" : "Låg",
              createdAt: new Date(d.created_at).toLocaleDateString("sv-SE"),
            }));
          }
        }

        // Fetch open faults - MUST filter by vessels in user's organization
        if (pref.email_new_faults && orgVesselIds.length > 0) {
          const { data: faults } = await supabase
            .from("fault_cases")
            .select(`
              title,
              priority,
              created_at,
              vessels(name)
            `)
            .in("vessel_id", orgVesselIds)
            .in("status", ["ny", "arbete_pagar"])
            .order("created_at", { ascending: false })
            .limit(10);

          if (faults) {
            digestData.openFaults = faults.map((f: any) => ({
              title: f.title,
              vesselName: f.vessels?.name || "Okänt fartyg",
              priority: f.priority === "kritisk" ? "Kritisk" : f.priority === "hog" ? "Hög" : f.priority === "normal" ? "Normal" : "Låg",
              createdAt: new Date(f.created_at).toLocaleDateString("sv-SE"),
            }));
          }
        }

        // Check if there's anything to report
        const hasContent = 
          digestData.expiringCertificates.length > 0 ||
          digestData.expiringControls.length > 0 ||
          digestData.newDeviations.length > 0 ||
          digestData.openFaults.length > 0;

        if (!hasContent) {
          console.log(`No content for user ${pref.user_id}, skipping`);
          continue;
        }

        // Build email HTML
        const periodLabel = frequency === "weekly" ? "Veckosammanfattning" : "Daglig sammanfattning";
        const html = buildDigestHtml(periodLabel, digestData, profile.full_name);

        // Send email
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`
          },
          body: JSON.stringify({
            from: "Sealogg <noreply@sealogg.se>",
            to: [profile.email],
            subject: `Sealogg ${periodLabel} - ${new Date().toLocaleDateString("sv-SE")}`,
            html
          })
        });

        if (response.ok) {
          sentCount++;
          console.log(`Sent digest to ${profile.email}`);
          
          // Log notification
          await supabase.from("notification_logs").insert({
            notification_type: "email",
            category: "digest",
            subject: `Sealogg ${periodLabel}`,
            status: "sent",
            sent_at: new Date().toISOString(),
            user_id: pref.user_id,
            organization_id: pref.organization_id
          });
        } else {
          const error = await response.text();
          console.error(`Failed to send to ${profile.email}:`, error);
        }
      } catch (userError) {
        console.error(`Error processing user ${pref.user_id}:`, userError);
      }
    }

    return new Response(
      JSON.stringify({ message: "Digest emails sent", sent: sentCount }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("Error in send-digest-email:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

function buildDigestHtml(periodLabel: string, data: DigestData, userName: string): string {
  let sections = "";

  if (data.expiringCertificates.length > 0) {
    const expiredCerts = data.expiringCertificates.filter(c => c.daysLeft < 0);
    const expiringCerts = data.expiringCertificates.filter(c => c.daysLeft >= 0);
    
    sections += `
      <div style="margin-bottom: 24px;">
        <h2 style="color: ${expiredCerts.length > 0 ? '#ef4444' : '#f59e0b'}; font-size: 16px; margin-bottom: 12px;">
          ${expiredCerts.length > 0 ? '🚨' : '⚠️'} Certifikat att uppmärksamma (${data.expiringCertificates.length})
        </h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #f3f4f6;">
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb;">Person</th>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb;">Certifikat</th>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb;">Status</th>
          </tr>
          ${data.expiringCertificates
            .sort((a, b) => a.daysLeft - b.daysLeft)
            .map(c => `
            <tr style="${c.daysLeft < 0 ? 'background: #fef2f2;' : ''}">
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${c.userName}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${c.certificateName}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; ${c.daysLeft < 0 ? 'color: #dc2626; font-weight: 600;' : ''}">
                ${c.daysLeft < 0 
                  ? `Utgånget sedan ${c.expiryDate} (${Math.abs(c.daysLeft)} dagar sedan)` 
                  : `Går ut ${c.expiryDate} (${c.daysLeft} dagar kvar)`}
              </td>
            </tr>
          `).join("")}
        </table>
      </div>
    `;
  }

  if (data.expiringControls.length > 0) {
    sections += `
      <div style="margin-bottom: 24px;">
        <h2 style="color: #f59e0b; font-size: 16px; margin-bottom: 12px;">🛠️ Kontrollpunkter som förfaller (${data.expiringControls.length})</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #f3f4f6;">
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb;">Kontrollpunkt</th>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb;">Fartyg</th>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb;">Förfaller</th>
          </tr>
          ${data.expiringControls.map(c => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${c.controlName}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${c.vesselName}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${c.dueDate} (${c.daysLeft} dagar)</td>
            </tr>
          `).join("")}
        </table>
      </div>
    `;
  }

  if (data.newDeviations.length > 0) {
    sections += `
      <div style="margin-bottom: 24px;">
        <h2 style="color: #ef4444; font-size: 16px; margin-bottom: 12px;">📌 Nya avvikelser (${data.newDeviations.length})</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #f3f4f6;">
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb;">Titel</th>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb;">Fartyg</th>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb;">Allvarlighet</th>
          </tr>
          ${data.newDeviations.map(d => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${d.title}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${d.vesselName}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${d.severity}</td>
            </tr>
          `).join("")}
        </table>
      </div>
    `;
  }

  if (data.openFaults.length > 0) {
    sections += `
      <div style="margin-bottom: 24px;">
        <h2 style="color: #3b82f6; font-size: 16px; margin-bottom: 12px;">🔧 Öppna felärenden (${data.openFaults.length})</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #f3f4f6;">
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb;">Titel</th>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb;">Fartyg</th>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb;">Prioritet</th>
          </tr>
          ${data.openFaults.map(f => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${f.title}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${f.vesselName}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${f.priority}</td>
            </tr>
          `).join("")}
        </table>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="https://sealogg.lovable.app/sealog-logo.png" alt="Sealogg" style="height: 40px;">
      </div>
      
      <h1 style="font-size: 20px; color: #111827; margin-bottom: 8px;">${periodLabel}</h1>
      <p style="color: #6b7280; margin-bottom: 24px;">Hej ${userName || ""}! Här är din översikt från Sealogg.</p>
      
      ${sections}
      
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
        <a href="https://sealogg.lovable.app/portal" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">Öppna Sealogg</a>
      </div>
      
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
        Du får detta mejl för att du har aktiverat ${periodLabel.toLowerCase()} i dina notifikationsinställningar.
      </p>
    </body>
    </html>
  `;
}
