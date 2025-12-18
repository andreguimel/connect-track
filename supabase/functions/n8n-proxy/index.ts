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
    const { webhookUrl, payload, instanceId } = await req.json();

    console.log('[n8n-proxy] === INÍCIO DA REQUISIÇÃO ===');
    console.log('[n8n-proxy] webhookUrl:', webhookUrl);
    console.log('[n8n-proxy] instanceId recebido:', instanceId || 'NÃO INFORMADO (usará fallback)');

    if (!webhookUrl) {
      console.error('[n8n-proxy] ERRO: webhookUrl não fornecido');
      throw new Error('webhookUrl is required');
    }

    // Get Evolution API credentials from environment
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error('[n8n-proxy] ERRO: Credenciais Evolution API não configuradas');
      throw new Error('Evolution API credentials not configured');
    }

    // Get user's connected instance from database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[n8n-proxy] ERRO: Header de autorização ausente');
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('[n8n-proxy] ERRO: Usuário não autorizado', authError);
      throw new Error('Unauthorized');
    }

    console.log('[n8n-proxy] Usuário autenticado:', user.id, user.email);

    // First, get ALL instances for this user (for debugging)
    const { data: allInstances, error: allInstancesError } = await supabase
      .from('evolution_instances')
      .select('id, instance_name, status, integration_type')
      .eq('user_id', user.id);
    
    console.log('[n8n-proxy] Total de instâncias do usuário:', allInstances?.length || 0);
    if (allInstances && allInstances.length > 0) {
      allInstances.forEach((inst, idx) => {
        console.log(`[n8n-proxy]   ${idx + 1}. ${inst.instance_name} | Status: ${inst.status} | Tipo: ${inst.integration_type} | ID: ${inst.id}`);
      });
    } else {
      console.log('[n8n-proxy] AVISO: Nenhuma instância encontrada para este usuário');
    }

    // Get user's specified instance or fall back to first connected instance
    let instance;
    if (instanceId) {
      console.log('[n8n-proxy] Buscando instância específica:', instanceId);
      // Get specific instance selected by user
      const { data: specificInstance, error: specificError } = await supabase
        .from('evolution_instances')
        .select('*')
        .eq('user_id', user.id)
        .eq('id', instanceId)
        .single();
      
      if (specificError || !specificInstance) {
        console.error('[n8n-proxy] ERRO: Instância específica não encontrada:', specificError);
        throw new Error('Instância selecionada não encontrada');
      }
      
      console.log('[n8n-proxy] Instância encontrada:', specificInstance.instance_name, '| Status:', specificInstance.status);
      
      if (specificInstance.status !== 'connected') {
        console.error('[n8n-proxy] ERRO: Instância não está conectada. Status atual:', specificInstance.status);
        throw new Error('A instância selecionada não está conectada');
      }
      
      instance = specificInstance;
    } else {
      console.log('[n8n-proxy] Nenhum instanceId informado, buscando primeira instância conectada...');
      // Fallback: Get first connected instance
      const { data: instances, error: instanceError } = await supabase
        .from('evolution_instances')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'connected')
        .limit(1);

      if (instanceError) {
        console.error('[n8n-proxy] ERRO ao buscar instância:', instanceError);
        throw new Error('Failed to fetch Evolution instance');
      }

      console.log('[n8n-proxy] Instâncias conectadas encontradas:', instances?.length || 0);

      if (!instances || instances.length === 0) {
        console.error('[n8n-proxy] ERRO: Nenhuma instância conectada encontrada para o usuário');
        throw new Error('No connected WhatsApp instance found. Please connect your WhatsApp first.');
      }
      
      instance = instances[0];
    }
    
    console.log('[n8n-proxy] === INSTÂNCIA SELECIONADA ===');
    console.log('[n8n-proxy] Nome:', instance.instance_name);
    console.log('[n8n-proxy] Tipo:', instance.integration_type);
    console.log('[n8n-proxy] Status:', instance.status);
    console.log('[n8n-proxy] ID:', instance.id);

    // Determine if recipient is a group or individual contact
    const isGroup = payload.recipientType === 'group' && payload.groupJid;
    
    // Format remoteJid based on recipient type
    let remoteJid: string | null = null;
    if (isGroup) {
      // For groups, use the group JID directly (already includes @g.us)
      remoteJid = payload.groupJid;
      console.log('Sending to group:', remoteJid);
    } else {
      // For contacts, format phone number for WhatsApp
      const phone = payload.phone?.replace(/\D/g, '');
      remoteJid = phone ? `${phone}@s.whatsapp.net` : null;
      console.log('Sending to contact:', remoteJid);
    }

    // Build enhanced payload with Evolution API credentials
    const enhancedPayload = {
      // Original payload fields
      ...payload,
      // Evolution API credentials (from environment)
      evolutionApiUrl: evolutionApiUrl.replace(/\/$/, ''),
      evolutionInstance: instance.instance_name,
      key: evolutionApiKey,
      // WhatsApp formatted recipient
      remoteJid,
      isGroup,
      // Ensure required fields
      isTest: payload.isTest || false,
      // Phantom mentions for groups
      mentionsEveryOne: isGroup ? (payload.mentionsEveryOne || false) : false,
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
