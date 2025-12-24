import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!accessToken || !supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("MercadoPago webhook received:", JSON.stringify(body, null, 2));

    // MercadoPago sends different types of notifications
    const { type, data } = body;

    if (type === "payment") {
      // Fetch payment details from MercadoPago
      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${data.id}`,
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      const payment = await paymentResponse.json();
      console.log("Payment details:", JSON.stringify(payment, null, 2));

      if (payment.status === "approved") {
        let userId: string;
        let planType: string = 'standard';

        // Parse external_reference - it can be JSON or just userId (legacy)
        try {
          const refData = JSON.parse(payment.external_reference);
          userId = refData.userId;
          planType = refData.planType || 'standard';
        } catch {
          // Legacy format: just the userId string
          userId = payment.external_reference;
        }

        if (!userId) {
          console.error("No user ID in external_reference");
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        console.log(`Processing payment for user ${userId}, plan: ${planType}`);

        // Calculate subscription end date (1 month from now)
        const subscriptionStartsAt = new Date();
        const subscriptionEndsAt = new Date();
        subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 1);

        // First check if subscription exists
        const { data: existingSubscription, error: fetchError } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (fetchError) {
          console.error("Error fetching subscription:", fetchError);
          throw fetchError;
        }

        let result;
        if (existingSubscription) {
          // Update existing subscription
          result = await supabase
            .from("subscriptions")
            .update({
              status: "active",
              plan_type: planType,
              subscription_started_at: subscriptionStartsAt.toISOString(),
              subscription_ends_at: subscriptionEndsAt.toISOString(),
              mercadopago_payer_id: payment.payer?.id?.toString() || null,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
        } else {
          // Create new subscription (should not happen normally, but fallback)
          console.log("No existing subscription found, creating new one");
          result = await supabase
            .from("subscriptions")
            .insert({
              user_id: userId,
              status: "active",
              plan_type: planType,
              trial_started_at: subscriptionStartsAt.toISOString(),
              trial_ends_at: subscriptionStartsAt.toISOString(),
              subscription_started_at: subscriptionStartsAt.toISOString(),
              subscription_ends_at: subscriptionEndsAt.toISOString(),
              mercadopago_payer_id: payment.payer?.id?.toString() || null,
            });
        }

        if (result.error) {
          console.error("Error saving subscription:", result.error);
          throw result.error;
        }

        console.log(`Subscription activated for user ${userId} with plan ${planType}, ends at ${subscriptionEndsAt.toISOString()}`);
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in mercadopago-webhook:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
