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
    const { 
      instanceId, 
      number, 
      message, 
      buttons,
      title,
      footer
    } = await req.json();

    console.log('[send-buttons] === INÍCIO DA REQUISIÇÃO ===');
    console.log('[send-buttons] instanceId:', instanceId);
    console.log('[send-buttons] number:', number);
    console.log('[send-buttons] message (descrição):', message?.substring(0, 50));
    console.log('[send-buttons] buttons:', JSON.stringify(buttons));
    console.log('[send-buttons] title:', title);
    console.log('[send-buttons] footer:', footer);

    if (!number) {
      throw new Error('number is required');
    }

    if (!buttons || buttons.length === 0) {
      throw new Error('buttons array is required');
    }

    // Get Evolution API credentials from environment
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error('[send-buttons] ERRO: Credenciais Evolution API não configuradas');
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

    console.log('[send-buttons] Usuário autenticado:', user.id);

    // Get user's instance
    let instance;
    if (instanceId) {
      const { data: specificInstance, error: specificError } = await supabase
        .from('evolution_instances')
        .select('*')
        .eq('user_id', user.id)
        .eq('id', instanceId)
        .single();
      
      if (specificError || !specificInstance) {
        throw new Error('Instância não encontrada');
      }
      
      if (specificInstance.status !== 'connected') {
        throw new Error('Instância não conectada');
      }
      
      instance = specificInstance;
    } else {
      const { data: instances } = await supabase
        .from('evolution_instances')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'connected')
        .limit(1);

      if (!instances || instances.length === 0) {
        throw new Error('Nenhuma instância conectada');
      }
      
      instance = instances[0];
    }

    console.log('[send-buttons] Instância:', instance.instance_name);

    // Format phone number - remove non-digits
    const cleanNumber = number.replace(/\D/g, '');
    
    // Build Evolution API payload for sendButtons
    // Format according to Evolution API v2 documentation
    const evolutionPayload = {
      number: cleanNumber,
      title: title || "", // Can be empty but must be present
      description: message || "", // The main message text
      footer: footer || "", // Can be empty
      buttons: buttons.map((btn: { displayText: string; id: string }) => ({
        type: "reply",
        displayText: btn.displayText,
        id: btn.id
      }))
    };

    console.log('[send-buttons] Evolution API payload:', JSON.stringify(evolutionPayload, null, 2));

    // Call Evolution API directly
    const evolutionUrl = `${evolutionApiUrl.replace(/\/$/, '')}/message/sendButtons/${instance.instance_name}`;
    console.log('[send-buttons] Calling Evolution API:', evolutionUrl);

    const response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify(evolutionPayload),
    });

    const responseText = await response.text();
    console.log('[send-buttons] Evolution API response status:', response.status);
    console.log('[send-buttons] Evolution API response:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { message: responseText };
    }

    if (!response.ok) {
      console.error('[send-buttons] Evolution API error:', responseData);
      throw new Error(`Evolution API error: ${JSON.stringify(responseData)}`);
    }

    return new Response(JSON.stringify({
      success: true,
      status: response.status,
      data: responseData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[send-buttons] Error:', error);
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
