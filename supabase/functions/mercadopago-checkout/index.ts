import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckoutRequest {
  userId: string;
  userEmail: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");
    }

    const { userId, userEmail }: CheckoutRequest = await req.json();

    if (!userId || !userEmail) {
      throw new Error("userId and userEmail are required");
    }

    // Get the origin from the request for the redirect URLs
    const origin = req.headers.get("origin") || "https://preview--zapmassa.lovable.app";

    // Create a preference for the subscription checkout
    const preferenceData = {
      items: [
        {
          title: "ZapMassa - Assinatura Mensal",
          description: "Acesso completo ao ZapMassa para envio de mensagens em massa via WhatsApp",
          quantity: 1,
          currency_id: "BRL",
          unit_price: 149.90,
        },
      ],
      payer: {
        email: userEmail,
      },
      back_urls: {
        success: `${origin}/?payment=success`,
        failure: `${origin}/?payment=failure`,
        pending: `${origin}/?payment=pending`,
      },
      auto_return: "approved",
      external_reference: userId,
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
    };

    console.log("Creating MercadoPago preference:", JSON.stringify(preferenceData, null, 2));

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preferenceData),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("MercadoPago error:", data);
      throw new Error(data.message || "Failed to create checkout");
    }

    console.log("MercadoPago preference created:", data.id);

    return new Response(
      JSON.stringify({
        checkoutUrl: data.init_point,
        preferenceId: data.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in mercadopago-checkout:", error);
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
