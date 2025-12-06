import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled';

export interface Subscription {
  id: string;
  user_id: string;
  status: SubscriptionStatus;
  trial_started_at: string;
  trial_ends_at: string;
  subscription_started_at: string | null;
  subscription_ends_at: string | null;
  mercadopago_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionLimits {
  maxCampaigns: number;
  maxContactsPerCampaign: number;
  canImportWhatsApp: boolean;
  canExportContacts: boolean;
}

const TRIAL_LIMITS: SubscriptionLimits = {
  maxCampaigns: 5,
  maxContactsPerCampaign: 20,
  canImportWhatsApp: false,
  canExportContacts: false,
};

const FULL_LIMITS: SubscriptionLimits = {
  maxCampaigns: Infinity,
  maxContactsPerCampaign: Infinity,
  canImportWhatsApp: true,
  canExportContacts: true,
};

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [campaignCount, setCampaignCount] = useState(0);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      // Check if trial has expired and update status
      const now = new Date();
      const trialEnds = new Date(data.trial_ends_at);
      
      if (data.status === 'trial' && now > trialEnds) {
        // Update status to expired
        await supabase
          .from('subscriptions')
          .update({ status: 'expired' })
          .eq('id', data.id);
        
        setSubscription({ ...data, status: 'expired' } as Subscription);
      } else {
        setSubscription(data as Subscription);
      }
    }
    
    setLoading(false);
  }, [user]);

  const fetchCampaignCount = useCallback(async () => {
    if (!user) return;

    const { count } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    setCampaignCount(count || 0);
  }, [user]);

  useEffect(() => {
    fetchSubscription();
    fetchCampaignCount();
  }, [fetchSubscription, fetchCampaignCount]);

  const isTrialActive = (): boolean => {
    if (!subscription) return false;
    if (subscription.status !== 'trial') return false;
    
    const now = new Date();
    const trialEnds = new Date(subscription.trial_ends_at);
    return now < trialEnds;
  };

  const isSubscriptionActive = (): boolean => {
    if (!subscription) return false;
    return subscription.status === 'active';
  };

  const hasAccess = (): boolean => {
    return isTrialActive() || isSubscriptionActive();
  };

  const getLimits = (): SubscriptionLimits => {
    if (isSubscriptionActive()) {
      return FULL_LIMITS;
    }
    return TRIAL_LIMITS;
  };

  const getRemainingTrialDays = (): number => {
    if (!subscription) return 0;
    
    const now = new Date();
    const trialEnds = new Date(subscription.trial_ends_at);
    const diffTime = trialEnds.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  };

  const canCreateCampaign = (): boolean => {
    if (!hasAccess()) return false;
    const limits = getLimits();
    return campaignCount < limits.maxCampaigns;
  };

  const getStatusLabel = (): string => {
    if (!subscription) return 'Carregando...';
    
    switch (subscription.status) {
      case 'trial':
        if (isTrialActive()) {
          return `Trial (${getRemainingTrialDays()} dias restantes)`;
        }
        return 'Trial expirado';
      case 'active':
        return 'Assinatura ativa';
      case 'expired':
        return 'Acesso expirado';
      case 'cancelled':
        return 'Assinatura cancelada';
      default:
        return 'Desconhecido';
    }
  };

  return {
    subscription,
    loading,
    campaignCount,
    isTrialActive,
    isSubscriptionActive,
    hasAccess,
    getLimits,
    getRemainingTrialDays,
    canCreateCampaign,
    getStatusLabel,
    refetch: () => {
      fetchSubscription();
      fetchCampaignCount();
    },
  };
}
