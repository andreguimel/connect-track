import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface EvolutionInstance {
  id: string;
  user_id: string;
  name: string;
  api_url: string;
  api_key: string;
  instance_name: string;
  status: 'disconnected' | 'connecting' | 'connected';
  phone_number?: string;
  created_at: string;
  updated_at: string;
}

export function useEvolutionInstances() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInstances = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('evolution_instances')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstances((data || []) as EvolutionInstance[]);
    } catch (error) {
      console.error('Error fetching instances:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  const createInstance = async (data: {
    name: string;
    api_url: string;
    api_key: string;
  }) => {
    if (!user) return null;

    // Check if user already has 3 instances
    if (instances.length >= 3) {
      toast({
        title: 'Limite atingido',
        description: 'Você pode ter no máximo 3 conexões.',
        variant: 'destructive',
      });
      return null;
    }

    const instanceName = `${data.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;

    try {
      // Create instance in Evolution API
      const { data: apiResponse, error: apiError } = await supabase.functions.invoke('evolution-api', {
        body: {
          action: 'create',
          apiUrl: data.api_url,
          apiKey: data.api_key,
          instanceName,
        },
      });

      if (apiError) throw apiError;
      if (!apiResponse.success) throw new Error(apiResponse.error);

      // Save instance to database
      const { data: instance, error: dbError } = await supabase
        .from('evolution_instances')
        .insert({
          user_id: user.id,
          name: data.name,
          api_url: data.api_url,
          api_key: data.api_key,
          instance_name: instanceName,
          status: 'disconnected',
        })
        .select()
        .single();

      if (dbError) throw dbError;

      await fetchInstances();
      
      return {
        instance: instance as EvolutionInstance,
        qrcode: apiResponse.qrcode,
      };
    } catch (error: any) {
      console.error('Error creating instance:', error);
      toast({
        title: 'Erro ao criar instância',
        description: error.message || 'Falha ao criar instância',
        variant: 'destructive',
      });
      return null;
    }
  };

  const getQRCode = async (instance: EvolutionInstance) => {
    try {
      // Update status to connecting
      await supabase
        .from('evolution_instances')
        .update({ status: 'connecting' })
        .eq('id', instance.id);

      const { data, error } = await supabase.functions.invoke('evolution-api', {
        body: {
          action: 'connect',
          apiUrl: instance.api_url,
          apiKey: instance.api_key,
          instanceName: instance.instance_name,
          instanceId: instance.id,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      await fetchInstances();
      return data.qrcode;
    } catch (error: any) {
      console.error('Error getting QR code:', error);
      toast({
        title: 'Erro ao obter QR Code',
        description: error.message || 'Falha ao obter QR code',
        variant: 'destructive',
      });
      return null;
    }
  };

  const checkStatus = async (instance: EvolutionInstance) => {
    try {
      const { data, error } = await supabase.functions.invoke('evolution-api', {
        body: {
          action: 'status',
          apiUrl: instance.api_url,
          apiKey: instance.api_key,
          instanceName: instance.instance_name,
          instanceId: instance.id,
        },
      });

      if (error) throw error;
      
      await fetchInstances();
      return data.status;
    } catch (error: any) {
      console.error('Error checking status:', error);
      return 'disconnected';
    }
  };

  const disconnectInstance = async (instance: EvolutionInstance) => {
    try {
      const { data, error } = await supabase.functions.invoke('evolution-api', {
        body: {
          action: 'disconnect',
          apiUrl: instance.api_url,
          apiKey: instance.api_key,
          instanceName: instance.instance_name,
          instanceId: instance.id,
        },
      });

      if (error) throw error;

      await fetchInstances();
      
      toast({
        title: 'Desconectado',
        description: 'Instância desconectada com sucesso.',
      });
    } catch (error: any) {
      console.error('Error disconnecting:', error);
      toast({
        title: 'Erro ao desconectar',
        description: error.message || 'Falha ao desconectar',
        variant: 'destructive',
      });
    }
  };

  const deleteInstance = async (instance: EvolutionInstance) => {
    try {
      // Delete from Evolution API first
      await supabase.functions.invoke('evolution-api', {
        body: {
          action: 'delete',
          apiUrl: instance.api_url,
          apiKey: instance.api_key,
          instanceName: instance.instance_name,
        },
      });

      // Delete from database
      const { error } = await supabase
        .from('evolution_instances')
        .delete()
        .eq('id', instance.id);

      if (error) throw error;

      await fetchInstances();
      
      toast({
        title: 'Instância removida',
        description: 'Conexão removida com sucesso.',
      });
    } catch (error: any) {
      console.error('Error deleting instance:', error);
      toast({
        title: 'Erro ao remover',
        description: error.message || 'Falha ao remover instância',
        variant: 'destructive',
      });
    }
  };

  return {
    instances,
    loading,
    fetchInstances,
    createInstance,
    getQRCode,
    checkStatus,
    disconnectInstance,
    deleteInstance,
  };
}
