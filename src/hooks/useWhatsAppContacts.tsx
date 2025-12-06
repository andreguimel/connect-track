import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useContacts } from '@/hooks/useData';

export interface WhatsAppContact {
  phoneNumber: string;
  name: string;
  isAdmin?: boolean;
  alreadyExists?: boolean;
}

export function useWhatsAppContacts() {
  const { toast } = useToast();
  const { addContacts } = useContacts();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);

  // Helper function to get existing contacts fresh from database
  const getExistingPhones = async (): Promise<Set<string>> => {
    const { data } = await supabase
      .from('contacts')
      .select('phone');
    return new Set((data || []).map(c => c.phone));
  };

  const fetchWhatsAppContacts = useCallback(async (instanceId: string): Promise<WhatsAppContact[]> => {
    setLoading(true);
    try {
      console.log('Fetching WhatsApp contacts for instance:', instanceId);
      
      const { data, error } = await supabase.functions.invoke('evolution-contacts', {
        body: { action: 'fetchContacts', instanceId },
      });

      console.log('Edge function response:', { data, error });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Erro ao buscar contatos');
      }

      // Check which contacts already exist (fresh from database)
      const existingPhones = await getExistingPhones();
      console.log('Existing phones in DB:', existingPhones.size);
      console.log('Contacts from WhatsApp:', data.contacts?.length || 0);

      const contactsWithStatus = (data.contacts || []).map((c: WhatsAppContact) => ({
        ...c,
        alreadyExists: existingPhones.has(c.phoneNumber),
      }));

      const newCount = contactsWithStatus.filter((c: WhatsAppContact) => !c.alreadyExists).length;
      console.log('New contacts (not in DB):', newCount);

      setContacts(contactsWithStatus);
      return contactsWithStatus;
    } catch (error) {
      console.error('Error fetching WhatsApp contacts:', error);
      const message = error instanceof Error ? error.message : 'Erro ao buscar contatos';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchGroupParticipants = useCallback(async (instanceId: string, groupJid: string): Promise<WhatsAppContact[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-contacts', {
        body: { action: 'fetchGroupParticipants', instanceId, groupJid },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Erro ao buscar participantes');
      }

      // Check which contacts already exist (fresh from database)
      const existingPhones = await getExistingPhones();
      const contactsWithStatus = (data.contacts || []).map((c: WhatsAppContact) => ({
        ...c,
        alreadyExists: existingPhones.has(c.phoneNumber),
      }));

      setContacts(contactsWithStatus);
      return contactsWithStatus;
    } catch (error) {
      console.error('Error fetching group participants:', error);
      const message = error instanceof Error ? error.message : 'Erro ao buscar participantes';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const importContacts = useCallback(async (
    contactsToImport: WhatsAppContact[],
    groupId?: string
  ): Promise<{ added: number; duplicates: number }> => {
    try {
      const newContacts = contactsToImport
        .filter(c => !c.alreadyExists)
        .map(c => ({
          name: c.name || `Contato ${c.phoneNumber}`,
          phone: c.phoneNumber,
          group_id: groupId,
        }));

      if (newContacts.length === 0) {
        toast({
          title: 'Nenhum contato novo',
          description: 'Todos os contatos selecionados já existem',
        });
        return { added: 0, duplicates: contactsToImport.length };
      }

      const result = await addContacts(newContacts);
      
      toast({
        title: 'Importação concluída',
        description: `${result.added} contatos adicionados${result.duplicates > 0 ? `, ${result.duplicates} duplicados ignorados` : ''}`,
      });

      return result;
    } catch (error) {
      console.error('Error importing contacts:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao importar contatos',
        variant: 'destructive',
      });
      return { added: 0, duplicates: 0 };
    }
  }, [addContacts, toast]);

  const clearContacts = useCallback(() => {
    setContacts([]);
  }, []);

  return {
    contacts,
    loading,
    fetchWhatsAppContacts,
    fetchGroupParticipants,
    importContacts,
    clearContacts,
  };
}
