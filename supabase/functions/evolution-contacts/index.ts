import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppContact {
  phoneNumber: string;
  name: string;
  isAdmin?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, instanceId, groupJid } = await req.json();

    if (!instanceId) {
      throw new Error('instanceId is required');
    }

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Evolution API credentials not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user
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

    // Get instance details
    const { data: instance, error: instanceError } = await supabase
      .from('evolution_instances')
      .select('*')
      .eq('id', instanceId)
      .eq('user_id', user.id)
      .single();

    if (instanceError || !instance) {
      throw new Error('Instance not found or access denied');
    }

    if (instance.status !== 'connected') {
      throw new Error('Instance is not connected. Please connect your WhatsApp first.');
    }

    const apiUrl = evolutionApiUrl.replace(/\/$/, '');
    let contacts: WhatsAppContact[] = [];

    if (action === 'fetchContacts') {
      console.log('Fetching contacts for instance:', instance.instance_name);

      // Fetch all contacts from Evolution API
      const response = await fetch(`${apiUrl}/chat/findContacts/${instance.instance_name}`, {
        method: 'POST',
        headers: {
          'apikey': evolutionApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Evolution API error:', errorText);
        throw new Error(`Failed to fetch contacts: ${response.status}`);
      }

      const rawData = await response.json();
      console.log('Raw Evolution API response type:', typeof rawData, Array.isArray(rawData));
      console.log('Raw data sample:', JSON.stringify(rawData?.slice?.(0, 2) || rawData).substring(0, 500));
      
      // Handle different response formats from Evolution API
      const contactsArray = Array.isArray(rawData) ? rawData : (rawData?.contacts || rawData?.data || []);
      console.log('Fetched contacts count:', contactsArray.length);

      // Map contacts to our format - Evolution API uses remoteJid for WhatsApp IDs
      contacts = contactsArray
        .filter((contact: { remoteJid?: string; isGroup?: boolean }) => {
          // Filter only individual contacts (not groups)
          return contact.remoteJid && 
                 contact.remoteJid.endsWith('@s.whatsapp.net') && 
                 !contact.isGroup;
        })
        .map((contact: { remoteJid: string; pushName?: string; name?: string }) => ({
          phoneNumber: contact.remoteJid.replace('@s.whatsapp.net', ''),
          name: contact.pushName || contact.name || 'Sem nome',
        }));
      
      console.log('Mapped contacts count:', contacts.length);

    } else if (action === 'fetchGroupParticipants') {
      if (!groupJid) {
        throw new Error('groupJid is required for fetchGroupParticipants');
      }

      console.log('Fetching participants for group:', groupJid);

      // Fetch group participants from Evolution API
      const response = await fetch(`${apiUrl}/group/participants/${instance.instance_name}?groupJid=${encodeURIComponent(groupJid)}`, {
        method: 'GET',
        headers: {
          'apikey': evolutionApiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Evolution API error:', errorText);
        throw new Error(`Failed to fetch group participants: ${response.status}`);
      }

      const data = await response.json();
      console.log('Fetched participants:', data);

      // Map participants to our format
      const participants = data?.participants || data || [];
      contacts = participants
        .filter((p: { id?: string }) => p.id && p.id.endsWith('@s.whatsapp.net'))
        .map((p: { id: string; admin?: string }) => ({
          phoneNumber: p.id.replace('@s.whatsapp.net', ''),
          name: '', // Participants don't have names directly, we'll fetch them later
          isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
        }));

    } else {
      throw new Error('Invalid action. Use "fetchContacts" or "fetchGroupParticipants"');
    }

    return new Response(JSON.stringify({
      success: true,
      contacts,
      count: contacts.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in evolution-contacts:', error);
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
