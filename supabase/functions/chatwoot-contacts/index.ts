import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatwootContact {
  id: number;
  name: string;
  phone_number: string | null;
  email: string | null;
  custom_attributes?: Record<string, unknown>;
}

interface ChatwootConversation {
  id: number;
  inbox_id: number;
  status: string;
  meta?: {
    sender?: {
      id: number;
      name: string;
      phone_number: string | null;
    };
  };
  labels?: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiUrl, apiToken, accountId } = await req.json();

    if (!apiUrl || !apiToken || !accountId) {
      return new Response(
        JSON.stringify({ success: false, error: 'API URL, Token e Account ID são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize API URL
    const baseUrl = apiUrl.replace(/\/$/, '');
    
    console.log(`Fetching contacts from Chatwoot: ${baseUrl}/api/v1/accounts/${accountId}/contacts`);

    // Fetch contacts from Chatwoot
    const contactsResponse = await fetch(
      `${baseUrl}/api/v1/accounts/${accountId}/contacts?page=1&per_page=500`,
      {
        headers: {
          'api_access_token': apiToken,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!contactsResponse.ok) {
      const errorText = await contactsResponse.text();
      console.error('Chatwoot contacts error:', contactsResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro ao buscar contatos: ${contactsResponse.status} - ${errorText}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contactsData = await contactsResponse.json();
    console.log(`Found ${contactsData.payload?.length || 0} contacts`);

    // Fetch conversations to get ticket/label info
    console.log(`Fetching conversations from Chatwoot`);
    const conversationsResponse = await fetch(
      `${baseUrl}/api/v1/accounts/${accountId}/conversations?status=all&page=1`,
      {
        headers: {
          'api_access_token': apiToken,
          'Content-Type': 'application/json',
        },
      }
    );

    let conversationsByContact: Record<number, { labels: string[], status: string }> = {};
    
    if (conversationsResponse.ok) {
      const conversationsData = await conversationsResponse.json();
      const conversations: ChatwootConversation[] = conversationsData.data?.payload || [];
      
      console.log(`Found ${conversations.length} conversations`);
      
      // Map conversations by contact ID
      for (const conv of conversations) {
        const contactId = conv.meta?.sender?.id;
        if (contactId) {
          if (!conversationsByContact[contactId]) {
            conversationsByContact[contactId] = { labels: [], status: conv.status };
          }
          if (conv.labels && conv.labels.length > 0) {
            conversationsByContact[contactId].labels.push(...conv.labels);
          }
        }
      }
    }

    // Transform contacts
    const contacts = (contactsData.payload || [])
      .filter((c: ChatwootContact) => c.phone_number)
      .map((c: ChatwootContact) => {
        // Clean phone number
        let phone = c.phone_number || '';
        phone = phone.replace(/\D/g, '');
        
        // Get ticket info from conversations
        const convInfo = conversationsByContact[c.id];
        const ticket = convInfo?.labels?.[0] || null; // Use first label as ticket

        return {
          id: c.id,
          name: c.name || `Contato ${phone}`,
          phoneNumber: phone,
          email: c.email,
          ticket: ticket,
        };
      })
      .filter((c: { phoneNumber: string }) => c.phoneNumber.length >= 10);

    console.log(`Returning ${contacts.length} valid contacts`);

    return new Response(
      JSON.stringify({ success: true, contacts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in chatwoot-contacts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
