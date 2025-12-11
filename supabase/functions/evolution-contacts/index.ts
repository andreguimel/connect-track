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

      const contactsMap = new Map<string, { phoneNumber: string; name: string }>();
      
      // Method 1: /chat/findChats - gets ALL chats (contacts + groups)
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
          const chatsArray = Array.isArray(data) ? data : (data?.chats || data?.data || []);
          console.log('/chat/findChats returned:', chatsArray.length, 'items');
          
          // Log ALL fields of first individual contact
          const firstContact = chatsArray.find((c: { remoteJid?: string }) => 
            c.remoteJid?.endsWith('@s.whatsapp.net')
          );
          if (firstContact) {
            console.log('FULL CONTACT DATA:', JSON.stringify(firstContact));
          }
          
          for (const c of chatsArray) {
            const jid = c.remoteJid || c.id || '';
            if (jid.endsWith('@s.whatsapp.net')) {
              const phoneNumber = jid.replace('@s.whatsapp.net', '');
              // Try ALL possible name fields
              const name = c.pushName || c.name || c.notify || c.verifiedName || c.displayName || c.shortName || c.formattedName || c.subject || '';
              contactsMap.set(phoneNumber, { phoneNumber, name: name || `Contato ${phoneNumber}` });
            }
          }
          console.log('After /chat/findChats, map has:', contactsMap.size, 'contacts');
        }
      } catch (e) {
        console.log('/chat/findChats error:', e);
      }

      // Method 2: /chat/findContacts - may have additional name info
      try {
        console.log('Trying /chat/findContacts endpoint...');
        const response = await fetch(`${apiUrl}/chat/findContacts/${instance.instance_name}`, {
          method: 'POST',
          headers: {
            'apikey': evolutionApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ where: {} }),
        });

        if (response.ok) {
          const data = await response.json();
          const contactsArray = Array.isArray(data) ? data : (data?.contacts || data?.data || []);
          console.log('/chat/findContacts returned:', contactsArray.length, 'items');
          
          for (const c of contactsArray) {
            const jid = c.remoteJid || c.id || '';
            if (jid.endsWith('@s.whatsapp.net')) {
              const phoneNumber = jid.replace('@s.whatsapp.net', '');
              const name = c.pushName || c.name || c.notify || c.verifiedName || c.displayName || '';
              
              // Only update if we have a real name
              if (name && name.trim()) {
                contactsMap.set(phoneNumber, { phoneNumber, name });
              } else if (!contactsMap.has(phoneNumber)) {
                contactsMap.set(phoneNumber, { phoneNumber, name: `Contato ${phoneNumber}` });
              }
            }
          }
        }
      } catch (e) {
        console.log('/chat/findContacts error:', e);
      }

      // Method 3: /chat/findMessages to extract names from message history
      try {
        console.log('Trying /chat/findMessages for name extraction...');
        const messagesResponse = await fetch(`${apiUrl}/chat/findMessages/${instance.instance_name}`, {
          method: 'POST',
          headers: {
            'apikey': evolutionApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ where: {}, limit: 1000 }),
        });

        if (messagesResponse.ok) {
          const data = await messagesResponse.json();
          const messages = Array.isArray(data) ? data : (data?.messages || data?.data || []);
          console.log('/chat/findMessages returned:', messages.length, 'messages');
          
          let namesFromMessages = 0;
          for (const msg of messages) {
            const jid = msg.key?.remoteJid || msg.remoteJid || '';
            if (jid.endsWith('@s.whatsapp.net')) {
              const phoneNumber = jid.replace('@s.whatsapp.net', '');
              const name = msg.pushName || '';
              
              if (name && name.trim()) {
                const existing = contactsMap.get(phoneNumber);
                if (!existing || existing.name.startsWith('Contato ')) {
                  contactsMap.set(phoneNumber, { phoneNumber, name });
                  namesFromMessages++;
                }
              }
            }
          }
          console.log('Names extracted from messages:', namesFromMessages);
        }
      } catch (e) {
        console.log('/chat/findMessages error:', e);
      }

      contacts = Array.from(contactsMap.values());
      
      // Count contacts with real names vs placeholder
      const withNames = contacts.filter(c => !c.name.startsWith('Contato ')).length;
      console.log(`Final: ${contacts.length} contacts, ${withNames} with real names`);

      contacts = Array.from(contactsMap.values());
      console.log('Final contacts count:', contacts.length);

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
