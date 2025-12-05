import { Contact, Campaign, CampaignContact, ContactGroup } from '@/types/contact';

const CONTACTS_KEY = 'whatsapp_contacts';
const CAMPAIGNS_KEY = 'whatsapp_campaigns';
const GROUPS_KEY = 'whatsapp_groups';

export const generateId = () => crypto.randomUUID();

// Groups
export const getGroups = (): ContactGroup[] => {
  const data = localStorage.getItem(GROUPS_KEY);
  if (!data) return [];
  return JSON.parse(data).map((g: ContactGroup) => ({
    ...g,
    createdAt: new Date(g.createdAt),
  }));
};

export const saveGroups = (groups: ContactGroup[]) => {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
};

export const addGroup = (name: string, color: string): ContactGroup => {
  const groups = getGroups();
  const group: ContactGroup = {
    id: generateId(),
    name,
    color,
    createdAt: new Date(),
  };
  groups.push(group);
  saveGroups(groups);
  return group;
};

export const updateGroup = (id: string, name: string, color: string) => {
  const groups = getGroups();
  const index = groups.findIndex(g => g.id === id);
  if (index !== -1) {
    groups[index].name = name;
    groups[index].color = color;
    saveGroups(groups);
  }
};

export const deleteGroup = (id: string) => {
  const groups = getGroups().filter(g => g.id !== id);
  saveGroups(groups);
  // Remove group from contacts
  const contacts = getContacts().map(c => 
    c.groupId === id ? { ...c, groupId: undefined } : c
  );
  saveContacts(contacts);
};

export const updateContactGroup = (contactId: string, groupId: string | undefined) => {
  const contacts = getContacts();
  const index = contacts.findIndex(c => c.id === contactId);
  if (index !== -1) {
    contacts[index].groupId = groupId;
    saveContacts(contacts);
  }
};

// Contacts
export const getContacts = (): Contact[] => {
  const data = localStorage.getItem(CONTACTS_KEY);
  if (!data) return [];
  return JSON.parse(data).map((c: Contact) => ({
    ...c,
    createdAt: new Date(c.createdAt),
  }));
};

export const saveContacts = (contacts: Contact[]) => {
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
};

export const addContacts = (newContacts: Omit<Contact, 'id' | 'createdAt'>[]) => {
  const existing = getContacts();
  const existingPhones = new Set(existing.map(c => c.phone));
  
  const toAdd = newContacts
    .filter(c => !existingPhones.has(c.phone))
    .map(c => ({
      ...c,
      id: generateId(),
      createdAt: new Date(),
    }));
  
  const updated = [...existing, ...toAdd];
  saveContacts(updated);
  return { added: toAdd.length, duplicates: newContacts.length - toAdd.length };
};

export const deleteContact = (id: string) => {
  const contacts = getContacts().filter(c => c.id !== id);
  saveContacts(contacts);
};

// Campaigns
export const getCampaigns = (): Campaign[] => {
  const data = localStorage.getItem(CAMPAIGNS_KEY);
  if (!data) return [];
  return JSON.parse(data).map((c: Campaign) => ({
    ...c,
    createdAt: new Date(c.createdAt),
    completedAt: c.completedAt ? new Date(c.completedAt) : undefined,
    contacts: c.contacts.map((cc: CampaignContact) => ({
      ...cc,
      sentAt: cc.sentAt ? new Date(cc.sentAt) : undefined,
      contact: {
        ...cc.contact,
        createdAt: new Date(cc.contact.createdAt),
      },
    })),
  }));
};

export const saveCampaigns = (campaigns: Campaign[]) => {
  localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(campaigns));
};

export const createCampaign = (name: string, message: string, contactIds: string[]): Campaign => {
  const contacts = getContacts();
  const selectedContacts = contacts.filter(c => contactIds.includes(c.id));
  
  const campaign: Campaign = {
    id: generateId(),
    name,
    message,
    contacts: selectedContacts.map(c => ({
      contactId: c.id,
      contact: c,
      status: 'pending',
    })),
    status: 'draft',
    createdAt: new Date(),
    stats: {
      total: selectedContacts.length,
      pending: selectedContacts.length,
      sent: 0,
      delivered: 0,
      failed: 0,
    },
  };
  
  const campaigns = getCampaigns();
  campaigns.push(campaign);
  saveCampaigns(campaigns);
  
  return campaign;
};

export const updateCampaign = (campaign: Campaign) => {
  const campaigns = getCampaigns();
  const index = campaigns.findIndex(c => c.id === campaign.id);
  if (index !== -1) {
    campaigns[index] = campaign;
    saveCampaigns(campaigns);
  }
};

export const updateCampaignContactStatus = (
  campaignId: string, 
  contactId: string, 
  status: CampaignContact['status'],
  error?: string
) => {
  const campaigns = getCampaigns();
  const campaign = campaigns.find(c => c.id === campaignId);
  
  if (campaign) {
    const contact = campaign.contacts.find(cc => cc.contactId === contactId);
    if (contact) {
      const oldStatus = contact.status;
      contact.status = status;
      contact.sentAt = status === 'sent' || status === 'delivered' ? new Date() : undefined;
      contact.error = error;
      
      // Update stats
      if (oldStatus !== status) {
        if (oldStatus === 'pending') campaign.stats.pending--;
        else if (oldStatus === 'sent') campaign.stats.sent--;
        else if (oldStatus === 'delivered') campaign.stats.delivered--;
        else if (oldStatus === 'failed') campaign.stats.failed--;
        
        if (status === 'pending') campaign.stats.pending++;
        else if (status === 'sent') campaign.stats.sent++;
        else if (status === 'delivered') campaign.stats.delivered++;
        else if (status === 'failed') campaign.stats.failed++;
      }
      
      // Check if campaign is complete
      if (campaign.stats.pending === 0 && campaign.status === 'running') {
        campaign.status = 'completed';
        campaign.completedAt = new Date();
      }
      
      saveCampaigns(campaigns);
    }
  }
};

export const deleteCampaign = (id: string) => {
  const campaigns = getCampaigns().filter(c => c.id !== id);
  saveCampaigns(campaigns);
};
