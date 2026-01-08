import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  fullName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, fullName }: WelcomeEmailRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SeaLogg <noreply@sealogg.se>",
        to: [email],
        subject: "Välkommen till SeaLogg!",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; }
              .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .logo { font-size: 28px; font-weight: 800; color: #2d5a3d; }
              .content { background: #f8faf9; border-radius: 12px; padding: 30px; }
              .button { display: inline-block; background: #2d5a3d; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">🌊 SeaLogg</div>
              </div>
              <div class="content">
                <h2>Välkommen${fullName ? `, ${fullName}` : ''}!</h2>
                <p>Tack för att du registrerade dig hos SeaLogg – din digitala fartygsloggbok.</p>
                <p>Med SeaLogg kan du enkelt:</p>
                <ul>
                  <li>Föra digital loggbok för dina resor</li>
                  <li>Hantera egenkontroller och service</li>
                  <li>Spåra avvikelser och felärenden</li>
                  <li>Ha koll på certifikat och behörigheter</li>
                </ul>
                <p>Ditt konto är nu aktivt och du kan logga in direkt.</p>
                <a href="https://sealogg.se/portal/login" class="button">Logga in</a>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} AhrensGroup AB</p>
                <p>Detta mejl skickades från SeaLogg</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", data);
      throw new Error(data.message || "Failed to send email");
    }

    console.log("Welcome email sent successfully:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
