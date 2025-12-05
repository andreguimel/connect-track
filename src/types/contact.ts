export interface ContactGroup {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  groupId?: string;
  tags?: string[];
  createdAt: Date;
}

export interface Message {
  id: string;
  content: string;
  createdAt: Date;
}

export interface CampaignContact {
  contactId: string;
  contact: Contact;
  status: 'pending' | 'sending' | 'sent' | 'delivered' | 'failed';
  sentAt?: Date;
  error?: string;
}

export interface Campaign {
  id: string;
  name: string;
  message: string;
  contacts: CampaignContact[];
  status: 'draft' | 'running' | 'paused' | 'completed';
  createdAt: Date;
  completedAt?: Date;
  stats: {
    total: number;
    pending: number;
    sent: number;
    delivered: number;
    failed: number;
  };
}

export type SendingStatus = 'pending' | 'sending' | 'sent' | 'delivered' | 'failed';
