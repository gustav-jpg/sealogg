import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageBase64 } = await req.json();

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(
        JSON.stringify({ error: "imageBase64 krävs" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Detect mime type from base64 prefix or default to jpeg
    let mimeType = "image/jpeg";
    let cleanBase64 = imageBase64;
    if (imageBase64.startsWith("data:")) {
      const match = imageBase64.match(/^data:([^;]+);base64,/);
      if (match) {
        mimeType = match[1];
        cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `Du är en expert på att analysera sjöfartscertifikat och andra maritima behörighetshandlingar. 
Analysera bilden och identifiera:
1. Typ av certifikat/behörighet (t.ex. Sjöbefälsklass VII, Fartygsbefäl klass VIII, Maskinbefäl, Sjöfartsbok, Grundläggande säkerhetsutbildning, etc.)
2. Utgångsdatum (om synligt)
3. Utfärdandedatum (om synligt)
4. Innehavarens namn (om synligt)

Svara ALLTID med ett anrop till funktionen extract_certificate_info.`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${cleanBase64}`,
                },
              },
              {
                type: "text",
                text: "Analysera detta certifikat/behörighetshandling och extrahera relevant information.",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_certificate_info",
              description: "Extrahera certifikatinformation från bilden",
              parameters: {
                type: "object",
                properties: {
                  certificate_type: {
                    type: "string",
                    description: "Typ av certifikat, t.ex. 'Sjöbefälsklass VII', 'Fartygsbefäl klass VIII', 'Maskinbefäl', 'Sjöfartsbok', 'Grundläggande säkerhetsutbildning', 'Begränsad radiooperatör (SRC)', 'Intyg om specialbehörighet', 'Lotsbehörighet' etc.",
                  },
                  expiry_date: {
                    type: "string",
                    description: "Utgångsdatum i formatet YYYY-MM-DD, eller null om ej synligt",
                  },
                  issue_date: {
                    type: "string",
                    description: "Utfärdandedatum i formatet YYYY-MM-DD, eller null om ej synligt",
                  },
                  holder_name: {
                    type: "string",
                    description: "Innehavarens namn om synligt, annars null",
                  },
                  confidence: {
                    type: "number",
                    description: "Hur säker du är på analysen, 0.0-1.0",
                  },
                  notes: {
                    type: "string",
                    description: "Eventuella ytterligare noteringar om certifikatet",
                  },
                },
                required: ["certificate_type", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_certificate_info" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI-tjänsten är tillfälligt överbelastad. Försök igen om en stund." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI-krediter slut. Kontakta administratör." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("AI returned no structured output");
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-certificate error:", e);
    return new Response(
      JSON.stringify({ error: "Kunde inte analysera certifikatet. Försök igen." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
