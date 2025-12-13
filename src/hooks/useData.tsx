import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Types
export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  group_id?: string;
  created_at: string;
}

export interface ContactGroup {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  category?: string;
  media_url?: string;
  media_type?: 'image' | 'video' | 'audio' | 'document';
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  message: string;
  message_variations?: string[];
  status: 'draft' | 'running' | 'paused' | 'completed' | 'scheduled';
  stats: {
    total: number;
    pending: number;
    sent: number;
    delivered: number;
    failed: number;
  };
  created_at: string;
  completed_at?: string;
  scheduled_at?: string;
  media_url?: string;
  media_type?: 'image' | 'video' | 'audio' | 'document';
}

export interface CampaignContact {
  id: string;
  campaign_id: string;
  contact_id: string;
  status: 'pending' | 'sending' | 'sent' | 'delivered' | 'failed';
  error?: string;
  sent_at?: string;
  contact?: Contact;
  recipient_type: 'contact' | 'group';
  group_jid?: string;
  variation_index?: number | null;
}

// Contacts Hook
export function useContacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    if (!user) return;
    
    // Paginate to handle >1000 contacts
    const allContacts: Contact[] = [];
    const pageSize = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);
      
      if (data && data.length > 0) {
        allContacts.push(...data);
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    
    setContacts(allContacts);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const addContact = async (contact: Omit<Contact, 'id' | 'created_at'>) => {
    if (!user) return { error: new Error('Not authenticated') };
    const { error } = await supabase
      .from('contacts')
      .insert({ ...contact, user_id: user.id });
    if (!error) fetchContacts();
    return { error };
  };

  const addContacts = async (newContacts: Omit<Contact, 'id' | 'created_at'>[]) => {
    if (!user) return { added: 0, duplicates: 0 };
    
    const contactsWithUser = newContacts.map(c => ({ ...c, user_id: user.id }));
    const { data, error } = await supabase
      .from('contacts')
      .insert(contactsWithUser)
      .select();
    
    if (!error) fetchContacts();
    return { 
      added: data?.length || 0, 
      duplicates: newContacts.length - (data?.length || 0) 
    };
  };

  const updateContact = async (id: string, updates: Partial<Contact>) => {
    const { error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', id);
    if (!error) fetchContacts();
    return { error };
  };

  const deleteContact = async (id: string) => {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id);
    if (!error) fetchContacts();
    return { error };
  };

  return { contacts, loading, fetchContacts, addContact, addContacts, updateContact, deleteContact };
}

// Groups Hook
export function useGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('contact_groups')
      .select('*')
      .order('created_at', { ascending: false });
    setGroups(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const addGroup = async (name: string, color: string) => {
    if (!user) return { error: new Error('Not authenticated') };
    const { data, error } = await supabase
      .from('contact_groups')
      .insert({ name, color, user_id: user.id })
      .select()
      .single();
    if (!error) fetchGroups();
    return { data, error };
  };

  const updateGroup = async (id: string, name: string, color: string) => {
    const { error } = await supabase
      .from('contact_groups')
      .update({ name, color })
      .eq('id', id);
    if (!error) fetchGroups();
    return { error };
  };

  const deleteGroup = async (id: string) => {
    const { error } = await supabase
      .from('contact_groups')
      .delete()
      .eq('id', id);
    if (!error) fetchGroups();
    return { error };
  };

  return { groups, loading, fetchGroups, addGroup, updateGroup, deleteGroup };
}

// Templates Hook
export function useTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('message_templates')
      .select('*')
      .order('updated_at', { ascending: false });
    setTemplates((data || []).map(t => ({
      ...t,
      media_type: t.media_type as MessageTemplate['media_type']
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const addTemplate = async (
    name: string, 
    content: string, 
    category?: string,
    options?: { media_url?: string; media_type?: 'image' | 'video' | 'audio' | 'document' }
  ) => {
    if (!user) return { error: new Error('Not authenticated') };
    const { data, error } = await supabase
      .from('message_templates')
      .insert({ 
        name, 
        content, 
        category, 
        user_id: user.id,
        media_url: options?.media_url || null,
        media_type: options?.media_type || null
      })
      .select()
      .single();
    if (!error) fetchTemplates();
    return { data, error };
  };

  const updateTemplate = async (
    id: string, 
    name: string, 
    content: string, 
    category?: string,
    options?: { media_url?: string | null; media_type?: 'image' | 'video' | 'audio' | 'document' | null }
  ) => {
    const updates: Record<string, unknown> = { name, content, category };
    if (options?.media_url !== undefined) updates.media_url = options.media_url;
    if (options?.media_type !== undefined) updates.media_type = options.media_type;
    
    const { error } = await supabase
      .from('message_templates')
      .update(updates)
      .eq('id', id);
    if (!error) fetchTemplates();
    return { error };
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase
      .from('message_templates')
      .delete()
      .eq('id', id);
    if (!error) fetchTemplates();
    return { error };
  };

  const uploadTemplateMedia = async (file: File): Promise<{ url: string | null; error: Error | null }> => {
    if (!user) return { url: null, error: new Error('Not authenticated') };
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/templates/${Date.now()}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('campaign-media')
      .upload(fileName, file);
    
    if (error) return { url: null, error };
    
    const { data } = supabase.storage
      .from('campaign-media')
      .getPublicUrl(fileName);
    
    return { url: data.publicUrl, error: null };
  };

  return { templates, loading, fetchTemplates, addTemplate, updateTemplate, deleteTemplate, uploadTemplateMedia };
}

// Campaigns Hook
export function useCampaigns() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    setCampaigns((data || []).map(c => ({
      ...c,
      status: c.status as Campaign['status'],
      stats: c.stats as Campaign['stats'],
      media_type: c.media_type as Campaign['media_type'],
      message_variations: c.message_variations as string[] | undefined
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const createCampaign = async (
    name: string, 
    message: string, 
    contactIds: string[],
    options?: {
      scheduled_at?: string;
      media_url?: string;
      media_type?: 'image' | 'video' | 'audio' | 'document';
      groupJids?: string[];
      message_variations?: string[];
    }
  ) => {
    if (!user) return { campaign: null, error: new Error('Not authenticated') };
    
    const groupJids = options?.groupJids || [];
    const totalRecipients = contactIds.length + groupJids.length;
    
    const stats = {
      total: totalRecipients,
      pending: totalRecipients,
      sent: 0,
      delivered: 0,
      failed: 0,
    };

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({ 
        name, 
        message, 
        user_id: user.id, 
        stats,
        status: options?.scheduled_at ? 'scheduled' : 'draft',
        scheduled_at: options?.scheduled_at || null,
        media_url: options?.media_url || null,
        media_type: options?.media_type || null,
        message_variations: options?.message_variations && options.message_variations.length > 0 
          ? options.message_variations 
          : null
      })
      .select()
      .single();

    if (error || !campaign) return { campaign: null, error };

    // Create campaign contacts for individual contacts
    const campaignContacts = contactIds.map(contactId => ({
      campaign_id: campaign.id,
      contact_id: contactId,
      recipient_type: 'contact',
    }));

    // Create campaign contacts for groups (using a placeholder contact_id)
    const campaignGroups = groupJids.map(groupJid => ({
      campaign_id: campaign.id,
      contact_id: crypto.randomUUID(), // Placeholder ID for groups
      recipient_type: 'group',
      group_jid: groupJid,
    }));

    const allRecipients = [...campaignContacts, ...campaignGroups];
    if (allRecipients.length > 0) {
      await supabase.from('campaign_contacts').insert(allRecipients);
    }
    
    fetchCampaigns();

    return { campaign, error: null };
  };

  const uploadCampaignMedia = async (file: File): Promise<{ url: string | null; error: Error | null }> => {
    if (!user) return { url: null, error: new Error('Not authenticated') };
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('campaign-media')
      .upload(fileName, file);
    
    if (error) return { url: null, error };
    
    const { data } = supabase.storage
      .from('campaign-media')
      .getPublicUrl(fileName);
    
    return { url: data.publicUrl, error: null };
  };

  const updateCampaign = async (id: string, updates: Partial<Campaign>) => {
    const { error } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', id);
    if (!error) fetchCampaigns();
    return { error };
  };

  const deleteCampaign = async (id: string) => {
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id);
    if (!error) fetchCampaigns();
    return { error };
  };

  const getCampaignContacts = async (campaignId: string): Promise<CampaignContact[]> => {
    // Paginate to handle >1000 campaign contacts
    const allCampaignContacts: CampaignContact[] = [];
    const pageSize = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data } = await supabase
        .from('campaign_contacts')
        .select('*')
        .eq('campaign_id', campaignId)
        .range(from, from + pageSize - 1);
      
      if (data && data.length > 0) {
        allCampaignContacts.push(...(data as CampaignContact[]));
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    
    if (allCampaignContacts.length === 0) return [];
    
    // Get contact IDs for non-group recipients
    const contactIds = allCampaignContacts
      .filter(cc => cc.recipient_type !== 'group')
      .map(cc => cc.contact_id);
    
    // Fetch contacts in batches (Supabase .in() also has limits)
    let contactsMap: Record<string, Contact> = {};
    if (contactIds.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < contactIds.length; i += batchSize) {
        const batch = contactIds.slice(i, i + batchSize);
        const { data: contacts } = await supabase
          .from('contacts')
          .select('*')
          .in('id', batch);
        
        if (contacts) {
          contacts.forEach(contact => {
            contactsMap[contact.id] = contact;
          });
        }
      }
    }
    
    return allCampaignContacts.map(cc => ({
      ...cc,
      status: cc.status as CampaignContact['status'],
      recipient_type: (cc.recipient_type || 'contact') as 'contact' | 'group',
      contact: cc.recipient_type !== 'group' ? contactsMap[cc.contact_id] : undefined,
    }));
  };

  const updateCampaignContactStatus = async (
    campaignId: string,
    contactId: string,
    status: CampaignContact['status'],
    error?: string,
    variationIndex?: number | null
  ) => {
    const updates: { status: string; error?: string; sent_at?: string; variation_index?: number | null } = { status };
    if (error) updates.error = error;
    if (variationIndex !== undefined) updates.variation_index = variationIndex;
    if (status === 'sent' || status === 'delivered') {
      updates.sent_at = new Date().toISOString();
    }

    await supabase
      .from('campaign_contacts')
      .update(updates)
      .eq('campaign_id', campaignId)
      .eq('contact_id', contactId);

    // Recalculate and update campaign stats in real-time
    await recalculateCampaignStats(campaignId);
  };

  const recalculateCampaignStats = async (campaignId: string) => {
    const { data: contacts } = await supabase
      .from('campaign_contacts')
      .select('status')
      .eq('campaign_id', campaignId);

    if (!contacts) return;

    const stats = {
      total: contacts.length,
      pending: contacts.filter(c => c.status === 'pending').length,
      sent: contacts.filter(c => c.status === 'sent' || c.status === 'sending').length,
      delivered: contacts.filter(c => c.status === 'delivered').length,
      failed: contacts.filter(c => c.status === 'failed').length,
    };

    await supabase
      .from('campaigns')
      .update({ stats })
      .eq('id', campaignId);
  };

  return { 
    campaigns, 
    loading, 
    fetchCampaigns, 
    createCampaign, 
    updateCampaign, 
    deleteCampaign,
    getCampaignContacts,
    updateCampaignContactStatus,
    uploadCampaignMedia
  };
}