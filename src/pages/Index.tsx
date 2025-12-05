import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { ContactsManager } from '@/components/contacts/ContactsManager';
import { CampaignsList } from '@/components/campaigns/CampaignsList';
import { SendMessage } from '@/components/send/SendMessage';
import { Settings } from '@/components/settings/Settings';
import { Campaign } from '@/types/contact';
import { updateCampaign, getCampaigns, updateCampaignContactStatus } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import { 
  getAntiBanSettings, 
  getRandomDelay, 
  canSendMore, 
  incrementDailySentCount,
  addMessageVariation,
  getRemainingDaily
} from '@/lib/antiban';

const WEBHOOK_STORAGE_KEY = 'zapsender_webhook_url';
const N8N_WEBHOOK_URL = 'https://oito.codigopro.tech/webhook/70343adc-43eb-4015-9571-d382c00bb03b';

const Index = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [webhookUrl, setWebhookUrl] = useState(() => {
    return localStorage.getItem(WEBHOOK_STORAGE_KEY) || N8N_WEBHOOK_URL;
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSending, setIsSending] = useState(false);

  const handleWebhookChange = (url: string) => {
    setWebhookUrl(url);
    localStorage.setItem(WEBHOOK_STORAGE_KEY, url);
  };

  const handleStartCampaign = useCallback(async (campaign: Campaign) => {
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
    campaign.status = 'running';
    updateCampaign(campaign);
    setRefreshKey(k => k + 1);

    let batchCount = 0;
    const pendingContacts = campaign.contacts.filter(cc => cc.status === 'pending');

    toast({
      title: "Campanha iniciada",
      description: `Enviando ${pendingContacts.length} mensagens com proteção anti-ban`,
    });

    for (const cc of pendingContacts) {
      // Check daily limit before each send
      if (!canSendMore(antiBanSettings)) {
        toast({
          title: "Limite diário atingido",
          description: "Campanha pausada. Continue amanhã.",
          variant: "destructive",
        });
        campaign.status = 'paused';
        updateCampaign(campaign);
        break;
      }

      try {
        updateCampaignContactStatus(campaign.id, cc.contactId, 'sending');
        setRefreshKey(k => k + 1);

        // Apply message variation if enabled
        let finalMessage = campaign.message.replace('{nome}', cc.contact.name);
        if (antiBanSettings.enableRandomVariation) {
          finalMessage = addMessageVariation(finalMessage);
        }

        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          mode: 'no-cors',
          body: JSON.stringify({
            campaignId: campaign.id,
            contactId: cc.contactId,
            phone: cc.contact.phone,
            name: cc.contact.name,
            message: finalMessage,
            timestamp: new Date().toISOString(),
          }),
        });

        updateCampaignContactStatus(campaign.id, cc.contactId, 'sent');
        incrementDailySentCount();
        setRefreshKey(k => k + 1);
        batchCount++;

        // Batch pause
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
          // Random delay between messages
          const delay = getRandomDelay(antiBanSettings);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error('Error sending message:', error);
        updateCampaignContactStatus(
          campaign.id,
          cc.contactId,
          'failed',
          error instanceof Error ? error.message : 'Erro desconhecido'
        );
        setRefreshKey(k => k + 1);
      }
    }

    setIsSending(false);
    const updated = getCampaigns().find(c => c.id === campaign.id);
    if (updated && updated.stats.pending === 0) {
      updated.status = 'completed';
      updated.completedAt = new Date();
      updateCampaign(updated);
    }

    setRefreshKey(k => k + 1);
    toast({
      title: "Campanha finalizada",
      description: `Restam ${getRemainingDaily(antiBanSettings)} envios hoje`,
    });
  }, [webhookUrl, toast]);

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
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="pl-64">
        <div className="container max-w-6xl py-8">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Index;
