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

      // Fetch contacts first to get names
      const contactsResponse = await fetch(`${apiUrl}/chat/findContacts/${instance.instance_name}`, {
        method: 'POST',
        headers: {
          'apikey': evolutionApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      // Build a map of phone -> name from contacts
      const contactsMap = new Map<string, string>();
      if (contactsResponse.ok) {
        const contactsData = await contactsResponse.json();
        const contactsArray = Array.isArray(contactsData) ? contactsData : (contactsData?.contacts || contactsData?.data || []);
        for (const c of contactsArray) {
          if (c.remoteJid && c.remoteJid.endsWith('@s.whatsapp.net')) {
            const phone = c.remoteJid.replace('@s.whatsapp.net', '');
            const name = c.pushName || c.name || '';
            if (name) {
              contactsMap.set(phone, name);
            }
          }
        }
        console.log('Built contacts map with', contactsMap.size, 'entries');
      }

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
      console.log('Raw participants response:', JSON.stringify(data).substring(0, 1000));
      
      // Handle different response formats from Evolution API
      let participants: unknown[] = [];
      if (Array.isArray(data)) {
        participants = data;
      } else if (data?.participants && Array.isArray(data.participants)) {
        participants = data.participants;
      } else if (data?.data && Array.isArray(data.data)) {
        participants = data.data;
      }
      
      console.log('Participants array length:', participants.length);
      if (participants.length > 0) {
        console.log('First participant sample:', JSON.stringify(participants[0]));
      }

      const mappedContacts: WhatsAppContact[] = [];
      
      for (const p of participants) {
        // Handle string format (just the jid)
        if (typeof p === 'string') {
          if (p.endsWith('@s.whatsapp.net')) {
            const phoneNumber = p.replace('@s.whatsapp.net', '');
            mappedContacts.push({
              phoneNumber,
              name: contactsMap.get(phoneNumber) || '',
              isAdmin: false,
            });
          }
          continue;
        }
        
        // Handle object format - Evolution API returns phoneNumber field with @s.whatsapp.net
        const participant = p as { id?: string; jid?: string; phoneNumber?: string; admin?: string | null; name?: string };
        
        // Try phoneNumber first (new Evolution API format), then jid, then id
        const whatsappId = participant.phoneNumber || participant.jid || participant.id || '';
        
        if (whatsappId.endsWith('@s.whatsapp.net')) {
          const phoneNumber = whatsappId.replace('@s.whatsapp.net', '');
          // Use name from participant if available, otherwise from contacts map
          const name = participant.name || contactsMap.get(phoneNumber) || '';
          mappedContacts.push({
            phoneNumber,
            name,
            isAdmin: participant.admin === 'admin' || participant.admin === 'superadmin',
          });
        }
      }
      
      contacts = mappedContacts;
      console.log('Mapped participants count:', contacts.length);

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
