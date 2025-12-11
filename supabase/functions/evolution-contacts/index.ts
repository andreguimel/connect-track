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

      let rawData: unknown[] = [];
      
      // Method 1: Try /chat/findChats endpoint (returns ALL chats including individual contacts)
      try {
        console.log('Trying /chat/findChats endpoint...');
        const chatsResponse = await fetch(`${apiUrl}/chat/findChats/${instance.instance_name}`, {
          method: 'POST',
          headers: {
            'apikey': evolutionApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        if (chatsResponse.ok) {
          const data = await chatsResponse.json();
          rawData = Array.isArray(data) ? data : (data?.chats || data?.data || []);
          console.log('findChats endpoint returned:', rawData.length, 'items');
          if (rawData.length > 0) {
            console.log('findChats sample:', JSON.stringify(rawData[0]).substring(0, 400));
          }
        } else {
          console.log('findChats failed with status:', chatsResponse.status);
        }
      } catch (e) {
        console.log('findChats endpoint error:', e);
      }

      // Method 2: Fallback to /chat/findContacts
      if (rawData.length === 0) {
        try {
          console.log('Trying /chat/findContacts endpoint...');
          const response = await fetch(`${apiUrl}/chat/findContacts/${instance.instance_name}`, {
            method: 'POST',
            headers: {
              'apikey': evolutionApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          });

          if (response.ok) {
            const data = await response.json();
            rawData = Array.isArray(data) ? data : (data?.contacts || data?.data || []);
            console.log('findContacts endpoint returned:', rawData.length, 'items');
          }
        } catch (e) {
          console.log('findContacts endpoint error:', e);
        }
      }

      // Log sample for debugging
      if (rawData.length > 0) {
        console.log('Sample item:', JSON.stringify(rawData[0]).substring(0, 400));
      }

      // Count total before filter for debugging
      const totalBeforeFilter = rawData.length;
      let groupsCount = 0;
      let contactsCount = 0;

      // Map contacts - ONLY accept @s.whatsapp.net contacts (real phone numbers)
      contacts = (rawData as Array<{ remoteJid?: string; id?: string; pushName?: string; name?: string; isGroup?: boolean; type?: string }>)
        .filter((contact) => {
          const jid = contact.remoteJid || contact.id || '';
          if (jid.endsWith('@g.us')) {
            groupsCount++;
            return false;
          }
          if (jid.endsWith('@s.whatsapp.net')) {
            contactsCount++;
            return true;
          }
          return false;
        })
        .map((contact) => {
          const jid = contact.remoteJid || contact.id || '';
          const phoneNumber = jid.replace('@s.whatsapp.net', '');
          const name = contact.pushName || contact.name || '';
          return {
            phoneNumber,
            name: name || `Contato ${phoneNumber}`,
          };
        });
      
      console.log(`Total: ${totalBeforeFilter}, Groups: ${groupsCount}, Contacts: ${contactsCount}`);

    } else if (action === 'fetchGroupParticipants') {
      if (!groupJid) {
        throw new Error('groupJid is required for fetchGroupParticipants');
      }

      console.log('Fetching participants for group:', groupJid);

      // Build a map of phone -> name from contacts first
      const contactsMap = new Map<string, string>();
      try {
        const contactsResponse = await fetch(`${apiUrl}/chat/findContacts/${instance.instance_name}`, {
          method: 'POST',
          headers: {
            'apikey': evolutionApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

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
      } catch (e) {
        console.log('Failed to build contacts map:', e);
      }

      // Try Method 1: fetchAllGroups with getParticipants (returns phone numbers in some versions)
      let participants: unknown[] = [];
      
      try {
        const groupsResponse = await fetch(`${apiUrl}/group/fetchAllGroups/${instance.instance_name}?getParticipants=true`, {
          method: 'GET',
          headers: {
            'apikey': evolutionApiKey,
            'Content-Type': 'application/json',
          },
        });

        if (groupsResponse.ok) {
          const groupsData = await groupsResponse.json();
          const groups = Array.isArray(groupsData) ? groupsData : (groupsData?.groups || groupsData?.data || []);
          
          // Find the specific group
          const targetGroup = groups.find((g: { id?: string; jid?: string }) => 
            g.id === groupJid || g.jid === groupJid
          );
          
          if (targetGroup?.participants) {
            participants = targetGroup.participants;
            console.log('Got participants from fetchAllGroups:', participants.length);
          }
        }
      } catch (e) {
        console.log('fetchAllGroups failed:', e);
      }

      // Method 2: Standard participants endpoint
      if (participants.length === 0) {
        const response = await fetch(`${apiUrl}/group/participants/${instance.instance_name}?groupJid=${encodeURIComponent(groupJid)}`, {
          method: 'GET',
          headers: {
            'apikey': evolutionApiKey,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Raw participants response sample:', JSON.stringify(data).substring(0, 500));
          
          if (Array.isArray(data)) {
            participants = data;
          } else if (data?.participants && Array.isArray(data.participants)) {
            participants = data.participants;
          } else if (data?.data && Array.isArray(data.data)) {
            participants = data.data;
          }
          console.log('Got participants from standard endpoint:', participants.length);
        }
      }

      // Method 3: Try group/findGroupInfos endpoint
      if (participants.length === 0) {
        try {
          const infoResponse = await fetch(`${apiUrl}/group/findGroupInfos/${instance.instance_name}?groupJid=${encodeURIComponent(groupJid)}`, {
            method: 'GET',
            headers: {
              'apikey': evolutionApiKey,
              'Content-Type': 'application/json',
            },
          });

          if (infoResponse.ok) {
            const infoData = await infoResponse.json();
            if (infoData?.participants) {
              participants = infoData.participants;
              console.log('Got participants from findGroupInfos:', participants.length);
            }
          }
        } catch (e) {
          console.log('findGroupInfos failed:', e);
        }
      }

      console.log('Total participants to process:', participants.length);
      if (participants.length > 0) {
        console.log('First participant sample:', JSON.stringify(participants[0]));
      }

      const mappedContacts: WhatsAppContact[] = [];
      
      for (const p of participants) {
        // Handle string format (just the jid)
        if (typeof p === 'string') {
          // Check for phone number format (with @s.whatsapp.net or just digits)
          if (p.endsWith('@s.whatsapp.net')) {
            const phoneNumber = p.replace('@s.whatsapp.net', '');
            mappedContacts.push({
              phoneNumber,
              name: contactsMap.get(phoneNumber) || '',
              isAdmin: false,
            });
          } else if (/^\d+$/.test(p)) {
            // Just digits - treat as phone number
            mappedContacts.push({
              phoneNumber: p,
              name: contactsMap.get(p) || '',
              isAdmin: false,
            });
          }
          continue;
        }
        
        // Handle object format
        const participant = p as { 
          id?: string; 
          jid?: string; 
          phoneNumber?: string; 
          number?: string;
          admin?: string | null; 
          name?: string;
          pushName?: string;
        };
        
        // Try multiple fields that might contain the phone number
        let phoneNumber = '';
        const whatsappId = participant.phoneNumber || participant.number || participant.jid || participant.id || '';
        
        if (whatsappId.endsWith('@s.whatsapp.net')) {
          phoneNumber = whatsappId.replace('@s.whatsapp.net', '');
        } else if (whatsappId.endsWith('@c.us')) {
          phoneNumber = whatsappId.replace('@c.us', '');
        } else if (/^\d+$/.test(whatsappId)) {
          // Just digits
          phoneNumber = whatsappId;
        } else if (whatsappId.includes('@') && !whatsappId.endsWith('@lid') && !whatsappId.endsWith('@g.us')) {
          // Some other format - extract number before @
          phoneNumber = whatsappId.split('@')[0];
          if (!/^\d+$/.test(phoneNumber)) {
            phoneNumber = ''; // Not a valid phone number
          }
        }
        
        // Skip @lid entries (linked IDs without real phone numbers)
        if (phoneNumber && phoneNumber.length > 5) {
          const name = participant.name || participant.pushName || contactsMap.get(phoneNumber) || '';
          mappedContacts.push({
            phoneNumber,
            name,
            isAdmin: participant.admin === 'admin' || participant.admin === 'superadmin',
          });
        }
      }
      
      contacts = mappedContacts;
      console.log('Mapped participants with phone numbers:', contacts.length);

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
