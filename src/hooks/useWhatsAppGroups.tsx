import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WhatsAppGroup {
  id: string;
  user_id: string;
  instance_id: string;
  group_jid: string;
  name: string;
  participants_count: number;
  created_at: string;
  updated_at: string;
}

export function useWhatsAppGroups() {
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchGroups = useCallback(async (instanceId?: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from('whatsapp_groups')
        .select('*')
        .order('name');

      if (instanceId) {
        query = query.eq('instance_id', instanceId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setGroups((data || []) as WhatsAppGroup[]);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Erro ao carregar grupos');
    } finally {
      setLoading(false);
    }
  }, []);

  const syncGroups = useCallback(async (instanceId: string) => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const { data, error } = await supabase.functions.invoke('evolution-groups', {
        body: { instanceId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setGroups(data.groups || []);
      toast.success(`${data.synced} grupos sincronizados`);
      return data.groups;
    } catch (error) {
      console.error('Error syncing groups:', error);
      const message = error instanceof Error ? error.message : 'Erro ao sincronizar grupos';
      toast.error(message);
      return [];
    } finally {
      setSyncing(false);
    }
  }, []);

  return {
    groups,
    loading,
    syncing,
    fetchGroups,
    syncGroups,
  };
}
