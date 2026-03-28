import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { organization_id, period_days = 60 } = await req.json();
    if (!organization_id) throw new Error("organization_id required");

    // Get vessels for this org
    const { data: vessels } = await supabase
      .from("vessels")
      .select("id, name")
      .eq("organization_id", organization_id);

    const vesselIds = vessels?.map((v: any) => v.id) || [];
    if (vesselIds.length === 0) {
      return new Response(JSON.stringify({ summary: "Inga fartyg hittades för denna organisation." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vesselNames = vessels?.reduce((acc: any, v: any) => { acc[v.id] = v.name; return acc; }, {});

    // Fetch data in parallel
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - period_days);
    const cutoffStr = cutoffDate.toISOString();

    const [
      { data: faultCases },
      { data: deviations },
      { data: logbooks },
      { data: controlStates },
    ] = await Promise.all([
      supabase
        .from("fault_cases")
        .select("id, title, status, priority, vessel_id, created_at, category")
        .in("vessel_id", vesselIds)
        .gte("created_at", cutoffStr)
        .order("created_at", { ascending: false }),
      supabase
        .from("deviations")
        .select("id, title, type, severity, status, vessel_id, date, description")
        .in("vessel_id", vesselIds)
        .gte("date", cutoffDate.toISOString().split("T")[0])
        .order("date", { ascending: false }),
      supabase
        .from("logbooks")
        .select("id, date, status, vessel_id, general_notes, passenger_count")
        .in("vessel_id", vesselIds)
        .gte("date", cutoffDate.toISOString().split("T")[0])
        .order("date", { ascending: false })
        .limit(50),
      supabase
        .from("vessel_control_point_state")
        .select("id, vessel_id, next_due_date, next_due_at_engine_hours, last_done_date, control_point_id")
        .in("vessel_id", vesselIds),
    ]);

    // Build context for AI
    const openFaults = faultCases?.filter((f: any) => ["ny", "varvsatgard", "arbete_pagar"].includes(f.status)) || [];
    const closedFaults = faultCases?.filter((f: any) => ["atgardad", "avslutad"].includes(f.status)) || [];
    const openDeviations = deviations?.filter((d: any) => ["oppen", "under_utredning"].includes(d.status)) || [];
    const closedDeviations = deviations?.filter((d: any) => ["aterrapporterad", "stangd"].includes(d.status)) || [];

    const overdue = controlStates?.filter((c: any) => {
      if (!c.next_due_date) return !c.last_done_date;
      return new Date(c.next_due_date) < new Date();
    }) || [];

    const todayStr = new Date().toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Group data per vessel for consistent reporting
    const vesselSummaries = vessels?.map((v: any) => {
      const vFaults = openFaults.filter((f: any) => f.vessel_id === v.id);
      const vDeviations = openDeviations.filter((d: any) => d.vessel_id === v.id);
      const vOverdue = overdue.filter((c: any) => c.vessel_id === v.id);
      const kritiska = vFaults.filter((f: any) => f.priority === "kritisk" || f.priority === "hog");
      const normalFaults = vFaults.filter((f: any) => f.priority !== "kritisk" && f.priority !== "hog");
      return `#### ${v.name}
- Öppna felärenden: ${vFaults.length} (varav ${kritiska.length} kritiska/höga)
${kritiska.map((f: any) => `  - [${f.priority}] "${f.title}"`).join("\n")}
${normalFaults.map((f: any) => `  - [${f.priority}] "${f.title}"`).join("\n")}
- Öppna avvikelser: ${vDeviations.length}
${vDeviations.map((d: any) => `  - [${d.severity}] "${d.title}" (${d.date})`).join("\n")}
- Förfallna kontrollpunkter: ${vOverdue.length}`;
    }).join("\n\n");

    const dataContext = `
Dagens datum: ${todayStr}
## Organisationsdata (senaste ${period_days} dagar)

### Sammanfattning
- Fartyg: ${vessels?.length || 0}
- Totalt öppna felärenden: ${openFaults.length} (varav ${openFaults.filter((f: any) => f.priority === "kritisk" || f.priority === "hog").length} kritiska/höga)
- Totalt öppna avvikelser: ${openDeviations.length}
- Förfallna kontrollpunkter: ${overdue.length}
- Loggboksanteckningar: ${logbooks?.length || 0}

### Per fartyg
${vesselSummaries}
`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Ge en kort och tydlig sammanfattning på svenska av organisationens driftsstatus baserat på data nedan. Gå rakt på sak.

Använd EXAKT detta markdown-format:

**Statusrapport [dagens datum]**

## Övergripande lägesbild
[2-3 meningar om nuläget]

## Kritiska punkter
- [punkt 1]
- [punkt 2]
(hoppa över denna sektion helt om inget är kritiskt)

## Trender
[Kort analys av mönster, t.ex. återkommande fel, fartyg med flest problem]

## Rekommendationer
- [åtgärd 1]
- [åtgärd 2]
- [åtgärd 3]

VIKTIGT:
- Använd ## för rubriker, INTE **fetstil**
- Använd - för listor
- Max 250 ord
- Svensk sjöfartsterminologi`,
          },
          {
            role: "user",
            content: dataContext,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI-tjänsten är tillfälligt överbelastad. Försök igen om en stund." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI-krediter slut. Kontakta administratören." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content || "Kunde inte generera sammanfattning.";

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-status-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
