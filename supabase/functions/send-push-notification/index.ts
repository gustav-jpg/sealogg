import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  user_id?: string;
  user_ids?: string[];
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("VAPID keys not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: PushPayload = await req.json();
    const userIds = payload.user_ids || (payload.user_id ? [payload.user_id] : []);

    if (userIds.length === 0) {
      throw new Error("No user_id or user_ids provided");
    }

    // Get push subscriptions for users
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIds);

    if (subError) throw subError;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subscriptions found", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Set VAPID details
    webpush.setVapidDetails(
      "mailto:support@sealogg.se",
      vapidPublicKey,
      vapidPrivateKey
    );

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      tag: payload.tag || "sealogg-notification",
      data: {
        url: payload.url || "/portal"
      }
    });

    // Send push notifications
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          };

          await webpush.sendNotification(pushSubscription, notificationPayload);

          // Log notification
          await supabase.from("notification_logs").insert({
            user_id: sub.user_id,
            notification_type: "push",
            category: payload.tag || "general",
            subject: payload.title,
            body: payload.body,
            status: "sent",
            sent_at: new Date().toISOString()
          });

          return true;
        } catch (error: unknown) {
          console.error("Push error for subscription:", sub.id, error);
          
          const statusCode = (error as { statusCode?: number })?.statusCode;
          
          // Remove invalid subscriptions (gone or not found)
          if (statusCode === 410 || statusCode === 404) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("id", sub.id);
          }

          // Log failed notification
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          await supabase.from("notification_logs").insert({
            user_id: sub.user_id,
            notification_type: "push",
            category: payload.tag || "general",
            subject: payload.title,
            body: payload.body,
            status: "failed",
            error_message: errorMessage
          });

          return false;
        }
      })
    );

    const sent = results.filter(r => r.status === "fulfilled" && r.value).length;

    return new Response(
      JSON.stringify({ message: "Push notifications sent", sent, total: subscriptions.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("Error in send-push-notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
