import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, instanceName, instanceId, integrationType } = await req.json();
    
    console.log(`Evolution API action: ${action}, instance: ${instanceName}`);

    // Get Evolution API credentials from environment variables
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Evolution API URL and Key not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
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

    const baseUrl = evolutionApiUrl.replace(/\/$/, '');
    const headers = {
      'Content-Type': 'application/json',
      'apikey': evolutionApiKey,
    };

    let result: any = {};

    switch (action) {
      case 'create': {
        // Create instance - support both WHATSAPP-BAILEYS (normal) and WHATSAPP-BUSINESS-BAILEYS (business app)
        const integration = integrationType || 'WHATSAPP-BAILEYS';
        console.log(`Creating instance: ${instanceName} with integration: ${integration}`);
        const createResponse = await fetch(`${baseUrl}/instance/create`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration,
          }),
        });
        
        const createData = await createResponse.json();
        console.log('Create response:', JSON.stringify(createData));
        
        if (!createResponse.ok) {
          throw new Error(createData.message || 'Failed to create instance');
        }

        result = {
          success: true,
          instance: createData.instance,
          qrcode: createData.qrcode,
        };
        break;
      }

      case 'connect': {
        // Get connection state and QR code
        console.log(`Getting QR code for: ${instanceName}`);
        const connectResponse = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
          method: 'GET',
          headers,
        });
        
        const connectData = await connectResponse.json();
        console.log('Connect response:', JSON.stringify(connectData));
        
        result = {
          success: true,
          qrcode: connectData.base64 || connectData.qrcode?.base64,
          pairingCode: connectData.pairingCode,
        };
        break;
      }

      case 'status': {
        // Check connection status
        console.log(`Checking status for: ${instanceName}`);
        const statusResponse = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
          method: 'GET',
          headers,
        });
        
        const statusData = await statusResponse.json();
        console.log('Status response:', JSON.stringify(statusData));

        const state = statusData.instance?.state || statusData.state || 'disconnected';
        let status = 'disconnected';
        
        if (state === 'open' || state === 'connected') {
          status = 'connected';
        } else if (state === 'connecting') {
          status = 'connecting';
        }

        // Update instance status in database if instanceId provided
        if (instanceId) {
          await supabase
            .from('evolution_instances')
            .update({ 
              status,
              phone_number: statusData.instance?.profilePictureUrl ? statusData.instance?.owner : null,
              updated_at: new Date().toISOString()
            })
            .eq('id', instanceId)
            .eq('user_id', user.id);
        }
        
        result = {
          success: true,
          status,
          state: statusData,
        };
        break;
      }

      case 'disconnect': {
        // Logout/disconnect instance
        console.log(`Disconnecting: ${instanceName}`);
        const logoutResponse = await fetch(`${baseUrl}/instance/logout/${instanceName}`, {
          method: 'DELETE',
          headers,
        });
        
        const logoutData = await logoutResponse.json();
        console.log('Logout response:', JSON.stringify(logoutData));

        // Update instance status in database
        if (instanceId) {
          await supabase
            .from('evolution_instances')
            .update({ status: 'disconnected', updated_at: new Date().toISOString() })
            .eq('id', instanceId)
            .eq('user_id', user.id);
        }
        
        result = {
          success: true,
          message: 'Instance disconnected',
        };
        break;
      }

      case 'delete': {
        // Delete instance from Evolution API
        console.log(`Deleting instance: ${instanceName}`);
        const deleteResponse = await fetch(`${baseUrl}/instance/delete/${instanceName}`, {
          method: 'DELETE',
          headers,
        });
        
        const deleteData = await deleteResponse.json();
        console.log('Delete response:', JSON.stringify(deleteData));
        
        result = {
          success: true,
          message: 'Instance deleted',
        };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Evolution API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
