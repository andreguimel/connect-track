import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatusPayload {
  campaignId: string;
  contactId: string;
  status: 'delivered' | 'failed';
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: StatusPayload = await req.json();
    console.log('Received status callback:', payload);

    const { campaignId, contactId, status, error } = payload;

    // Validate required fields
    if (!campaignId || !contactId || !status) {
      console.error('Missing required fields:', { campaignId, contactId, status });
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: campaignId, contactId, status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate status value
    if (!['delivered', 'failed'].includes(status)) {
      console.error('Invalid status value:', status);
      return new Response(
        JSON.stringify({ success: false, error: 'Status must be "delivered" or "failed"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update campaign_contacts status
    const { error: updateError } = await supabase
      .from('campaign_contacts')
      .update({
        status,
        error: error || null,
        sent_at: status === 'delivered' ? new Date().toISOString() : null,
      })
      .eq('campaign_id', campaignId)
      .eq('contact_id', contactId);

    if (updateError) {
      console.error('Error updating campaign_contacts:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Updated contact ${contactId} in campaign ${campaignId} to status: ${status}`);

    // Recalculate campaign stats
    const { data: contacts, error: fetchError } = await supabase
      .from('campaign_contacts')
      .select('status')
      .eq('campaign_id', campaignId);

    if (fetchError) {
      console.error('Error fetching campaign contacts:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stats = {
      total: contacts.length,
      pending: contacts.filter(c => c.status === 'pending').length,
      sent: contacts.filter(c => c.status === 'sent' || c.status === 'sending').length,
      delivered: contacts.filter(c => c.status === 'delivered').length,
      failed: contacts.filter(c => c.status === 'failed').length,
    };

    console.log('Campaign stats:', stats);

    // Update campaign stats
    const { error: statsError } = await supabase
      .from('campaigns')
      .update({ stats })
      .eq('id', campaignId);

    if (statsError) {
      console.error('Error updating campaign stats:', statsError);
      return new Response(
        JSON.stringify({ success: false, error: statsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if campaign is complete
    const isComplete = stats.pending === 0 && stats.sent === 0;
    if (isComplete) {
      await supabase
        .from('campaigns')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId);
      
      console.log(`Campaign ${campaignId} marked as completed`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        stats,
        completed: isComplete
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
