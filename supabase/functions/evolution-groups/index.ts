import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instanceId } = await req.json();

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

    console.log('Fetching groups for instance:', instance.instance_name);

    // Fetch groups from Evolution API
    const apiUrl = evolutionApiUrl.replace(/\/$/, '');
    const response = await fetch(`${apiUrl}/group/fetchAllGroups/${instance.instance_name}?getParticipants=false`, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Evolution API error:', errorText);
      throw new Error(`Failed to fetch groups: ${response.status}`);
    }

    const groups = await response.json();
    console.log('Fetched groups count:', groups?.length || 0);

    // Sync groups to database
    const groupsToUpsert = (groups || []).map((group: { id: string; subject: string; size?: number }) => ({
      user_id: user.id,
      instance_id: instanceId,
      group_jid: group.id,
      name: group.subject || 'Grupo sem nome',
      participants_count: group.size || 0,
      updated_at: new Date().toISOString(),
    }));

    if (groupsToUpsert.length > 0) {
      // Delete groups that no longer exist for this instance
      const currentJids = groupsToUpsert.map((g: { group_jid: string }) => g.group_jid);
      await supabase
        .from('whatsapp_groups')
        .delete()
        .eq('user_id', user.id)
        .eq('instance_id', instanceId)
        .not('group_jid', 'in', `(${currentJids.join(',')})`);

      // Upsert current groups
      const { error: upsertError } = await supabase
        .from('whatsapp_groups')
        .upsert(groupsToUpsert, {
          onConflict: 'user_id,group_jid',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error('Error upserting groups:', upsertError);
        throw new Error('Failed to save groups');
      }
    }

    // Fetch updated groups from database
    const { data: savedGroups, error: fetchError } = await supabase
      .from('whatsapp_groups')
      .select('*')
      .eq('user_id', user.id)
      .eq('instance_id', instanceId)
      .order('name');

    if (fetchError) {
      throw new Error('Failed to fetch saved groups');
    }

    return new Response(JSON.stringify({
      success: true,
      groups: savedGroups,
      synced: groupsToUpsert.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in evolution-groups:', error);
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
