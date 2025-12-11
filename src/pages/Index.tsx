import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { ContactsManager } from '@/components/contacts/ContactsManager';
import { CampaignsList } from '@/components/campaigns/CampaignsList';
import { SendMessage } from '@/components/send/SendMessage';
import { Settings } from '@/components/settings/Settings';
import { TemplatesManager } from '@/components/templates/TemplatesManager';
import { SubscriptionBanner } from '@/components/subscription/SubscriptionBanner';
import { PaywallOverlay } from '@/components/subscription/PaywallOverlay';
import { useCampaigns, Campaign } from '@/hooks/useData';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  getAntiBanSettings, 
  getRandomDelay, 
  canSendMore, 
  incrementDailySentCount,
  addMessageVariation,
  getRemainingDaily
} from '@/lib/antiban';

const WEBHOOK_STORAGE_KEY = 'zapsender_webhook_url';

const Index = () => {
  const { toast } = useToast();
  const { updateCampaign, getCampaignContacts, updateCampaignContactStatus, fetchCampaigns } = useCampaigns();
  const { refetch: refetchSubscription } = useSubscription();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [webhookUrl, setWebhookUrl] = useState(() => {
    return localStorage.getItem(WEBHOOK_STORAGE_KEY) || '';
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSending, setIsSending] = useState(false);

  // Handle payment callback
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      toast({
        title: "Pagamento confirmado!",
        description: "Sua assinatura foi ativada com sucesso.",
      });
      refetchSubscription();
    } else if (payment === 'failure') {
      toast({
        title: "Pagamento não concluído",
        description: "O pagamento não foi processado. Tente novamente.",
        variant: "destructive",
      });
    } else if (payment === 'pending') {
      toast({
        title: "Pagamento pendente",
        description: "Seu pagamento está sendo processado.",
      });
    }
  }, [searchParams, toast, refetchSubscription]);

  const handleWebhookChange = (url: string) => {
    setWebhookUrl(url);
    localStorage.setItem(WEBHOOK_STORAGE_KEY, url);
  };

  const handleStartCampaign = useCallback(async (campaign: Campaign, contactFilter?: 'all' | 'failed') => {
    if (!webhookUrl) {
      toast({
        title: "Webhook não configurado",
        description: "Configure o webhook do n8n nas configurações",
        variant: "destructive",
      });
      setActiveTab('settings');
      return;
    }

    const antiBanSettings = getAntiBanSettings();
    
    if (!canSendMore(antiBanSettings)) {
      toast({
        title: "Limite diário atingido",
        description: `Você já atingiu o limite de ${antiBanSettings.dailyLimit} mensagens hoje`,
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    await updateCampaign(campaign.id, { status: 'running' });
    setRefreshKey(k => k + 1);

    const campaignContacts = await getCampaignContacts(campaign.id);
    const pendingContacts = campaignContacts.filter(cc => cc.status === 'pending');
    let batchCount = 0;

    toast({
      title: "Campanha iniciada",
      description: `Enviando ${pendingContacts.length} mensagens com proteção anti-ban`,
    });

    for (const cc of pendingContacts) {
      if (!canSendMore(antiBanSettings)) {
        toast({
          title: "Limite diário atingido",
          description: "Campanha pausada. Continue amanhã.",
          variant: "destructive",
        });
        await updateCampaign(campaign.id, { status: 'paused' });
        break;
      }

      try {
        await updateCampaignContactStatus(campaign.id, cc.contact_id, 'sending');
        setRefreshKey(k => k + 1);

        let finalMessage = campaign.message.replace('{nome}', cc.contact?.name || '');
        
        // Variação por IA (prioridade) ou variação básica
        if (antiBanSettings.enableAIVariation) {
          try {
            const { data, error } = await supabase.functions.invoke('variate-message', {
              body: { message: finalMessage }
            });
            if (!error && data?.success && data?.variedMessage) {
              finalMessage = data.variedMessage;
              console.log('Mensagem variada por IA:', finalMessage.substring(0, 50) + '...');
            } else {
              console.warn('Fallback para variação básica:', error || data?.error);
              if (antiBanSettings.enableRandomVariation) {
                finalMessage = addMessageVariation(finalMessage);
              }
            }
          } catch (aiError) {
            console.warn('Erro na variação por IA, usando básica:', aiError);
            if (antiBanSettings.enableRandomVariation) {
              finalMessage = addMessageVariation(finalMessage);
            }
          }
        } else if (antiBanSettings.enableRandomVariation) {
          finalMessage = addMessageVariation(finalMessage);
        }

        const { error } = await supabase.functions.invoke('n8n-proxy', {
          body: {
            webhookUrl,
            payload: {
              campaignId: campaign.id,
              contactId: cc.contact_id,
              phone: cc.contact?.phone,
              name: cc.contact?.name,
              message: finalMessage,
              mediaUrl: campaign.media_url,
              mediaType: campaign.media_type,
              timestamp: new Date().toISOString(),
            },
          },
        });

        if (error) throw error;

        await updateCampaignContactStatus(campaign.id, cc.contact_id, 'sent');
        incrementDailySentCount();
        setRefreshKey(k => k + 1);
        batchCount++;

        if (batchCount >= antiBanSettings.batchSize) {
          toast({
            title: "Pausa entre lotes",
            description: `Aguardando ${antiBanSettings.batchPauseMinutes} minutos...`,
          });
          await new Promise(resolve => 
            setTimeout(resolve, antiBanSettings.batchPauseMinutes * 60 * 1000)
          );
          batchCount = 0;
        } else {
          const delay = getRandomDelay(antiBanSettings);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error('Error sending message:', error);
        await updateCampaignContactStatus(
          campaign.id,
          cc.contact_id,
          'failed',
          error instanceof Error ? error.message : 'Erro desconhecido'
        );
        setRefreshKey(k => k + 1);
      }
    }

    setIsSending(false);
    
    // Check if campaign is complete
    const updatedContacts = await getCampaignContacts(campaign.id);
    const stillPending = updatedContacts.filter(c => c.status === 'pending').length;
    if (stillPending === 0) {
      await updateCampaign(campaign.id, { 
        status: 'completed', 
        completed_at: new Date().toISOString() 
      });
    }

    await fetchCampaigns();
    setRefreshKey(k => k + 1);
    toast({
      title: "Campanha finalizada",
      description: `Restam ${getRemainingDaily(antiBanSettings)} envios hoje`,
    });
  }, [webhookUrl, toast, updateCampaign, getCampaignContacts, updateCampaignContactStatus, fetchCampaigns]);

  const handleCampaignCreated = () => {
    setRefreshKey(k => k + 1);
    setActiveTab('campaigns');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard key={refreshKey} />;
      case 'contacts':
        return <ContactsManager />;
      case 'templates':
        return <TemplatesManager />;
      case 'campaigns':
        return <CampaignsList key={refreshKey} onStartCampaign={handleStartCampaign} />;
      case 'send':
        return <SendMessage webhookUrl={webhookUrl} onCampaignCreated={handleCampaignCreated} />;
      case 'settings':
        return <Settings webhookUrl={webhookUrl} onWebhookChange={handleWebhookChange} />;
      default:
        return <Dashboard key={refreshKey} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PaywallOverlay />
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="pt-14 lg:pt-0 lg:pl-64">
        <div className="container max-w-6xl px-4 py-6 lg:py-8 space-y-6">
          <SubscriptionBanner />
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Index;