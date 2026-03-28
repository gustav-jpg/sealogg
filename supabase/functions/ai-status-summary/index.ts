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

    const dataContext = `
Dagens datum: ${todayStr}
## Organisationsdata (senaste ${period_days} dagar)

### Fartyg
${vessels?.map((v: any) => `- ${v.name}`).join("\n")}

### Felärenden
- Totalt: ${faultCases?.length || 0} (${openFaults.length} öppna, ${closedFaults.length} stängda)
- Kritiska/höga öppna: ${openFaults.filter((f: any) => f.priority === "kritisk" || f.priority === "hog").length}
${openFaults.slice(0, 10).map((f: any) => `  - [${f.priority}] "${f.title}" på ${vesselNames[f.vessel_id]} (status: ${f.status})`).join("\n")}

### Avvikelser
- Totalt: ${deviations?.length || 0} (${openDeviations.length} öppna, ${closedDeviations.length} stängda)
- Allvarliga: ${openDeviations.filter((d: any) => d.severity === "hog").length}
${openDeviations.slice(0, 10).map((d: any) => `  - [${d.severity}/${d.type}] "${d.title}" på ${vesselNames[d.vessel_id]} (${d.date})`).join("\n")}

### Loggböcker
- Totalt: ${logbooks?.length || 0} loggboksanteckningar
- Genomsnittligt passagerarantal: ${logbooks?.length ? Math.round((logbooks.reduce((s: number, l: any) => s + (l.passenger_count || 0), 0)) / logbooks.length) : 0}

### Underhåll
- Förfallna kontrollpunkter: ${overdue.length}
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
            content: `Ge en kort och tydlig sammanfattning på svenska av organisationens driftsstatus baserat på data nedan. Gå rakt på sak utan inledande presentation.

Strukturera svaret med dessa rubriker (använd markdown):
1. **Övergripande lägesbild** — 2-3 meningar om nuläget
2. **Kritiska punkter** — Lista med det som kräver omedelbar uppmärksamhet (hoppa över om inget är kritiskt)
3. **Trender** — Kort analys av mönster (t.ex. återkommande fel, fartyg med flest problem)
4. **Rekommendationer** — 2-3 konkreta åtgärdsförslag

Håll det koncist (max 250 ord). Använd svensk sjöfartsterminologi. Börja ALDRIG med en mening som förklarar vad du är eller vad du gör.`,
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
