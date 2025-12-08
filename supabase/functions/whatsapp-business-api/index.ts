import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, accountId, ...params } = await req.json();
    console.log(`WhatsApp Business API action: ${action}`);

    let result;

    switch (action) {
      case 'verify_credentials': {
        // Verify the access token and get phone number info
        const { accessToken, phoneNumberId } = params;
        
        const response = await fetch(
          `${GRAPH_API_URL}/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating&access_token=${accessToken}`
        );
        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error.message || 'Invalid credentials');
        }
        
        result = {
          success: true,
          phoneNumber: data.display_phone_number,
          verifiedName: data.verified_name,
          qualityRating: data.quality_rating
        };
        break;
      }

      case 'send_text': {
        // Send a simple text message
        const { to, message } = params;
        
        const { data: account, error } = await supabase
          .from('whatsapp_business_accounts')
          .select('*')
          .eq('id', accountId)
          .eq('user_id', user.id)
          .single();

        if (error || !account) {
          throw new Error('Account not found');
        }

        const response = await fetch(
          `${GRAPH_API_URL}/${account.phone_number_id}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${account.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: to.replace(/\D/g, ''),
              type: 'text',
              text: { body: message }
            }),
          }
        );
        
        result = await response.json();
        console.log('Send text result:', JSON.stringify(result));
        break;
      }

      case 'send_template': {
        // Send a template message
        const { to, templateName, language, components } = params;
        
        const { data: account, error } = await supabase
          .from('whatsapp_business_accounts')
          .select('*')
          .eq('id', accountId)
          .eq('user_id', user.id)
          .single();

        if (error || !account) {
          throw new Error('Account not found');
        }

        const payload: any = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to.replace(/\D/g, ''),
          type: 'template',
          template: {
            name: templateName,
            language: { code: language || 'pt_BR' },
          }
        };

        if (components && components.length > 0) {
          payload.template.components = components;
        }

        const response = await fetch(
          `${GRAPH_API_URL}/${account.phone_number_id}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${account.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          }
        );
        
        result = await response.json();
        console.log('Send template result:', JSON.stringify(result));
        break;
      }

      case 'send_interactive': {
        // Send interactive message with buttons or list
        const { to, interactiveType, header, body, footer, buttons, sections } = params;
        
        const { data: account, error } = await supabase
          .from('whatsapp_business_accounts')
          .select('*')
          .eq('id', accountId)
          .eq('user_id', user.id)
          .single();

        if (error || !account) {
          throw new Error('Account not found');
        }

        const interactive: any = {
          type: interactiveType, // 'button' or 'list'
          body: { text: body },
        };

        if (header) {
          interactive.header = header;
        }

        if (footer) {
          interactive.footer = { text: footer };
        }

        if (interactiveType === 'button' && buttons) {
          interactive.action = {
            buttons: buttons.map((btn: any, index: number) => ({
              type: 'reply',
              reply: {
                id: btn.id || `btn_${index}`,
                title: btn.title.substring(0, 20) // Max 20 chars
              }
            }))
          };
        }

        if (interactiveType === 'list' && sections) {
          interactive.action = {
            button: 'Ver opções',
            sections: sections
          };
        }

        const response = await fetch(
          `${GRAPH_API_URL}/${account.phone_number_id}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${account.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: to.replace(/\D/g, ''),
              type: 'interactive',
              interactive
            }),
          }
        );
        
        result = await response.json();
        console.log('Send interactive result:', JSON.stringify(result));
        break;
      }

      case 'send_media': {
        // Send media message (image, video, audio, document)
        const { to, mediaType, mediaUrl, caption, filename } = params;
        
        const { data: account, error } = await supabase
          .from('whatsapp_business_accounts')
          .select('*')
          .eq('id', accountId)
          .eq('user_id', user.id)
          .single();

        if (error || !account) {
          throw new Error('Account not found');
        }

        const mediaPayload: any = {
          link: mediaUrl,
        };

        if (caption && ['image', 'video', 'document'].includes(mediaType)) {
          mediaPayload.caption = caption;
        }

        if (filename && mediaType === 'document') {
          mediaPayload.filename = filename;
        }

        const response = await fetch(
          `${GRAPH_API_URL}/${account.phone_number_id}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${account.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: to.replace(/\D/g, ''),
              type: mediaType,
              [mediaType]: mediaPayload
            }),
          }
        );
        
        result = await response.json();
        console.log('Send media result:', JSON.stringify(result));
        break;
      }

      case 'get_templates': {
        // Fetch templates from WhatsApp Business Account
        const { data: account, error } = await supabase
          .from('whatsapp_business_accounts')
          .select('*')
          .eq('id', accountId)
          .eq('user_id', user.id)
          .single();

        if (error || !account) {
          throw new Error('Account not found');
        }

        const response = await fetch(
          `${GRAPH_API_URL}/${account.business_account_id}/message_templates?access_token=${account.access_token}`
        );
        
        result = await response.json();
        console.log('Get templates result:', JSON.stringify(result));
        break;
      }

      case 'create_template': {
        // Create a new message template
        const { name, category, language, components } = params;
        
        const { data: account, error } = await supabase
          .from('whatsapp_business_accounts')
          .select('*')
          .eq('id', accountId)
          .eq('user_id', user.id)
          .single();

        if (error || !account) {
          throw new Error('Account not found');
        }

        const response = await fetch(
          `${GRAPH_API_URL}/${account.business_account_id}/message_templates`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${account.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name,
              category,
              language,
              components
            }),
          }
        );
        
        result = await response.json();
        console.log('Create template result:', JSON.stringify(result));
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('WhatsApp Business API error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
