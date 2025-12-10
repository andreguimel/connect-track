import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export type IntegrationType = 'WHATSAPP-BAILEYS' | 'WHATSAPP-BUSINESS-BAILEYS';

export interface EvolutionInstance {
  id: string;
  user_id: string;
  name: string;
  api_url: string;
  api_key: string;
  instance_name: string;
  status: 'disconnected' | 'connecting' | 'connected';
  phone_number?: string;
  integration_type: IntegrationType;
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

  const createInstance = async (name?: string, integrationType: IntegrationType = 'WHATSAPP-BAILEYS') => {
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

    // Auto-generate name if not provided
    const isBusinessApp = integrationType === 'WHATSAPP-BUSINESS-BAILEYS';
    const displayName = name || `WhatsApp ${isBusinessApp ? 'Business ' : ''}${instances.length + 1}`;
    const instanceName = `whatsapp_${user.id.slice(0, 8)}_${Date.now()}`;

    try {
      // Create instance in Evolution API (uses default env vars)
      const { data: apiResponse, error: apiError } = await supabase.functions.invoke('evolution-api', {
        body: {
          action: 'create',
          instanceName,
          integrationType,
        },
      });

      if (apiError) throw apiError;
      if (!apiResponse.success) throw new Error(apiResponse.error);

      // Save instance to database with placeholder values (actual API uses env vars)
      const { data: instance, error: dbError } = await supabase
        .from('evolution_instances')
        .insert({
          user_id: user.id,
          name: displayName,
          api_url: 'default',
          api_key: 'default',
          instance_name: instanceName,
          status: 'disconnected',
          integration_type: integrationType,
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

  const renameInstance = async (instance: EvolutionInstance, newName: string) => {
    try {
      const { error } = await supabase
        .from('evolution_instances')
        .update({ name: newName })
        .eq('id', instance.id);

      if (error) throw error;

      await fetchInstances();
      
      toast({
        title: 'Nome atualizado',
        description: `Conexão renomeada para "${newName}".`,
      });
      
      return true;
    } catch (error: any) {
      console.error('Error renaming instance:', error);
      toast({
        title: 'Erro ao renomear',
        description: error.message || 'Falha ao renomear instância',
        variant: 'destructive',
      });
      return false;
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
    renameInstance,
  };
}
