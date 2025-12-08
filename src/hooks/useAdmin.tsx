import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface UserStats {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  subscription_status: string | null;
  subscription_plan: string | null;
  trial_ends_at: string | null;
  devices_count: number;
  messages_sent: number;
  campaigns_count: number;
}

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserStats[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const checkAdminRole = useCallback(async () => {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!error && data) {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
    setLoading(false);
  }, [user]);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;

    setLoadingUsers(true);
    const { data, error } = await supabase.rpc('get_admin_user_stats');

    if (!error && data) {
      setUsers(data as UserStats[]);
    }
    setLoadingUsers(false);
  }, [isAdmin]);

  const updateSubscription = async (
    userId: string,
    status: 'trial' | 'active' | 'expired' | 'cancelled',
    planType?: string
  ) => {
    const { data, error } = await supabase.rpc('admin_update_subscription', {
      _user_id: userId,
      _status: status,
      _plan_type: planType || null
    });

    if (error) {
      throw error;
    }

    await fetchUsers();
    return data;
  };

  useEffect(() => {
    checkAdminRole();
  }, [checkAdminRole]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, fetchUsers]);

  return {
    isAdmin,
    loading,
    users,
    loadingUsers,
    fetchUsers,
    updateSubscription
  };
}
