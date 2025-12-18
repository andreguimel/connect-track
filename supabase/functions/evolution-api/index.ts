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
    const { action, instanceName, instanceId, integrationType, phoneNumber } = await req.json();
    
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
        // Determine the correct integration type
        // WHATSAPP-BAILEYS = WhatsApp normal via QR Code
        // WHATSAPP-BUSINESS = WhatsApp Business App (requires phone number)
        const isBusinessApp = integrationType === 'WHATSAPP-BUSINESS-BAILEYS';
        const integration = isBusinessApp ? 'WHATSAPP-BUSINESS' : 'WHATSAPP-BAILEYS';
        
        console.log(`Creating instance: ${instanceName} with integration: ${integration}`);
        
        // Generate a unique token for the instance
        const instanceToken = crypto.randomUUID();
        
        // Build the payload
        const createPayload: Record<string, unknown> = {
          instanceName,
          qrcode: true,
          integration,
          token: instanceToken,
        };
        
        // WhatsApp Business requires a phone number
        if (isBusinessApp) {
          if (!phoneNumber) {
            throw new Error('Número de telefone é obrigatório para WhatsApp Business');
          }
          // Format phone number (remove non-digits and ensure proper format)
          const formattedNumber = phoneNumber.replace(/\D/g, '');
          createPayload.number = formattedNumber;
          // Keep qrcode: true for Business as well - user still needs to scan QR
        }
        
        console.log('Create payload:', JSON.stringify(createPayload));
        
        const createResponse = await fetch(`${baseUrl}/instance/create`, {
          method: 'POST',
          headers,
          body: JSON.stringify(createPayload),
        });
        
        const createData = await createResponse.json();
        console.log('Create response:', JSON.stringify(createData));
        
        if (!createResponse.ok) {
          throw new Error(createData.message || createData.error || 'Failed to create instance');
        }

        // If no QR code returned on create, fetch it via connect endpoint
        let qrcode = createData.qrcode;
        if (!qrcode?.base64 && !createData.base64) {
          console.log('No QR on create, fetching via connect endpoint...');
          const connectResponse = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
            method: 'GET',
            headers,
          });
          const connectData = await connectResponse.json();
          console.log('Connect after create response:', JSON.stringify(connectData));
          qrcode = connectData.base64 ? { base64: connectData.base64 } : connectData.qrcode;
        }

        result = {
          success: true,
          instance: createData.instance,
          qrcode: qrcode,
          pairingCode: createData.pairingCode,
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
        
        let status = 'disconnected';
        let statusData: any = {};
        
        try {
          const statusResponse = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
            method: 'GET',
            headers,
          });
          
          // If instance doesn't exist or API error, treat as disconnected
          if (!statusResponse.ok) {
            console.log(`Status check failed with HTTP ${statusResponse.status}`);
            status = 'disconnected';
          } else {
            statusData = await statusResponse.json();
            console.log('Status response:', JSON.stringify(statusData));

            // Handle various state formats from Evolution API
            const state = (statusData.instance?.state || statusData.state || '').toLowerCase();
            
            // Only 'open' and 'connected' mean truly connected
            if (state === 'open' || state === 'connected') {
              status = 'connected';
            } else if (state === 'connecting' || state === 'qrcode') {
              status = 'connecting';
            } else {
              // Any other state (close, closed, disconnected, empty, etc.) = disconnected
              status = 'disconnected';
            }
          }
        } catch (fetchError) {
          console.error('Error fetching status from Evolution API:', fetchError);
          status = 'disconnected';
        }

        // Always update instance status in database if instanceId provided
        if (instanceId) {
          const { error: updateError } = await supabase
            .from('evolution_instances')
            .update({ 
              status,
              phone_number: statusData.instance?.owner || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', instanceId)
            .eq('user_id', user.id);
          
          if (updateError) {
            console.error('Error updating instance status in DB:', updateError);
          }
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
