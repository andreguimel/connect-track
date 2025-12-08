import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WhatsAppBusinessAccount {
  id: string;
  user_id: string;
  name: string;
  phone_number_id: string;
  business_account_id: string;
  access_token: string;
  phone_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppBusinessTemplate {
  id: string;
  user_id: string;
  account_id: string;
  template_name: string;
  template_id: string | null;
  language: string;
  category: string;
  components: any;
  status: string;
  created_at: string;
  updated_at: string;
}

export const useWhatsAppBusiness = () => {
  const [accounts, setAccounts] = useState<WhatsAppBusinessAccount[]>([]);
  const [templates, setTemplates] = useState<WhatsAppBusinessTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_business_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error: any) {
      console.error('Error fetching business accounts:', error);
      toast.error('Erro ao carregar contas Business');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async (accountId?: string) => {
    try {
      let query = supabase
        .from('whatsapp_business_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (accountId) {
        query = query.eq('account_id', accountId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
    }
  };

  const verifyCredentials = async (
    accessToken: string,
    phoneNumberId: string
  ): Promise<{ success: boolean; phoneNumber?: string; verifiedName?: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await supabase.functions.invoke('whatsapp-business-api', {
        body: {
          action: 'verify_credentials',
          accessToken,
          phoneNumberId,
        },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    } catch (error: any) {
      console.error('Error verifying credentials:', error);
      toast.error(error.message || 'Erro ao verificar credenciais');
      return { success: false };
    }
  };

  const createAccount = async (
    name: string,
    phoneNumberId: string,
    businessAccountId: string,
    accessToken: string
  ): Promise<WhatsAppBusinessAccount | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Verify credentials first
      const verification = await verifyCredentials(accessToken, phoneNumberId);
      if (!verification.success) {
        throw new Error('Credenciais inválidas');
      }

      const { data, error } = await supabase
        .from('whatsapp_business_accounts')
        .insert({
          user_id: user.id,
          name,
          phone_number_id: phoneNumberId,
          business_account_id: businessAccountId,
          access_token: accessToken,
          phone_number: verification.phoneNumber,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Conta Business conectada com sucesso!');
      await fetchAccounts();
      return data;
    } catch (error: any) {
      console.error('Error creating account:', error);
      toast.error(error.message || 'Erro ao criar conta');
      return null;
    }
  };

  const deleteAccount = async (accountId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('whatsapp_business_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;

      toast.success('Conta removida com sucesso');
      await fetchAccounts();
      return true;
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error('Erro ao remover conta');
      return false;
    }
  };

  const sendTextMessage = async (
    accountId: string,
    to: string,
    message: string
  ) => {
    try {
      const response = await supabase.functions.invoke('whatsapp-business-api', {
        body: {
          action: 'send_text',
          accountId,
          to,
          message,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data.error) throw new Error(response.data.error.message);

      return response.data;
    } catch (error: any) {
      console.error('Error sending text:', error);
      throw error;
    }
  };

  const sendTemplateMessage = async (
    accountId: string,
    to: string,
    templateName: string,
    language: string = 'pt_BR',
    components?: any[]
  ) => {
    try {
      const response = await supabase.functions.invoke('whatsapp-business-api', {
        body: {
          action: 'send_template',
          accountId,
          to,
          templateName,
          language,
          components,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data.error) throw new Error(response.data.error.message);

      return response.data;
    } catch (error: any) {
      console.error('Error sending template:', error);
      throw error;
    }
  };

  const sendInteractiveMessage = async (
    accountId: string,
    to: string,
    interactiveType: 'button' | 'list',
    body: string,
    options: {
      header?: { type: string; text?: string; image?: { link: string } };
      footer?: string;
      buttons?: { id?: string; title: string }[];
      sections?: any[];
    }
  ) => {
    try {
      const response = await supabase.functions.invoke('whatsapp-business-api', {
        body: {
          action: 'send_interactive',
          accountId,
          to,
          interactiveType,
          body,
          ...options,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data.error) throw new Error(response.data.error.message);

      return response.data;
    } catch (error: any) {
      console.error('Error sending interactive:', error);
      throw error;
    }
  };

  const sendMediaMessage = async (
    accountId: string,
    to: string,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    mediaUrl: string,
    caption?: string,
    filename?: string
  ) => {
    try {
      const response = await supabase.functions.invoke('whatsapp-business-api', {
        body: {
          action: 'send_media',
          accountId,
          to,
          mediaType,
          mediaUrl,
          caption,
          filename,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data.error) throw new Error(response.data.error.message);

      return response.data;
    } catch (error: any) {
      console.error('Error sending media:', error);
      throw error;
    }
  };

  const syncTemplatesFromMeta = async (accountId: string) => {
    try {
      const response = await supabase.functions.invoke('whatsapp-business-api', {
        body: {
          action: 'get_templates',
          accountId,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data.error) throw new Error(response.data.error.message);

      const metaTemplates = response.data.data || [];
      
      // Sync to local database
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      for (const template of metaTemplates) {
        const { error } = await supabase
          .from('whatsapp_business_templates')
          .upsert({
            user_id: user.id,
            account_id: accountId,
            template_name: template.name,
            template_id: template.id,
            language: template.language,
            category: template.category,
            components: template.components || [],
            status: template.status,
          }, {
            onConflict: 'account_id,template_name',
            ignoreDuplicates: false,
          });

        if (error) {
          console.error('Error syncing template:', error);
        }
      }

      await fetchTemplates(accountId);
      toast.success(`${metaTemplates.length} templates sincronizados`);
    } catch (error: any) {
      console.error('Error syncing templates:', error);
      toast.error('Erro ao sincronizar templates');
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  return {
    accounts,
    templates,
    loading,
    fetchAccounts,
    fetchTemplates,
    verifyCredentials,
    createAccount,
    deleteAccount,
    sendTextMessage,
    sendTemplateMessage,
    sendInteractiveMessage,
    sendMediaMessage,
    syncTemplatesFromMeta,
  };
};
