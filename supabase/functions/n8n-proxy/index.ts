import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { webhookUrl, payload } = await req.json();

    console.log('Proxying request to n8n:', { webhookUrl, payload });

    if (!webhookUrl) {
      throw new Error('webhookUrl is required');
    }

    // Get Evolution API credentials from environment
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Evolution API credentials not configured');
    }

    // Get user's connected instance from database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's connected instance
    const { data: instances, error: instanceError } = await supabase
      .from('evolution_instances')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'connected')
      .limit(1);

    if (instanceError) {
      console.error('Error fetching instance:', instanceError);
      throw new Error('Failed to fetch Evolution instance');
    }

    if (!instances || instances.length === 0) {
      throw new Error('No connected WhatsApp instance found. Please connect your WhatsApp first.');
    }

    const instance = instances[0];
    console.log('Using Evolution instance:', instance.instance_name);

    // Format phone number for WhatsApp
    const phone = payload.phone?.replace(/\D/g, '');
    const remoteJid = phone ? `${phone}@s.whatsapp.net` : null;

    // Build enhanced payload with Evolution API credentials
    const enhancedPayload = {
      // Original payload fields
      ...payload,
      // Evolution API credentials (from environment)
      evolutionApiUrl: evolutionApiUrl.replace(/\/$/, ''),
      evolutionInstance: instance.instance_name,
      key: evolutionApiKey,
      // WhatsApp formatted phone
      remoteJid,
      // Ensure required fields
      isTest: payload.isTest || false,
    };

    console.log('Enhanced payload:', {
      ...enhancedPayload,
      key: '***hidden***',
      message: enhancedPayload.message?.substring(0, 50) + '...',
    });

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(enhancedPayload),
    });

    const responseText = await response.text();
    console.log('n8n response status:', response.status);
    console.log('n8n response body:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { message: responseText };
    }

    return new Response(JSON.stringify({
      success: response.ok,
      status: response.status,
      data: responseData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in n8n-proxy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
