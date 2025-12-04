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

const WEBHOOK_STORAGE_KEY = 'zapsender_webhook_url';

const Index = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [webhookUrl, setWebhookUrl] = useState(() => {
    return localStorage.getItem(WEBHOOK_STORAGE_KEY) || '';
  });
  const [refreshKey, setRefreshKey] = useState(0);

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

    campaign.status = 'running';
    updateCampaign(campaign);
    setRefreshKey(k => k + 1);

    for (const cc of campaign.contacts) {
      if (cc.status !== 'pending') continue;

      try {
        updateCampaignContactStatus(campaign.id, cc.contactId, 'sending');
        setRefreshKey(k => k + 1);

        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          mode: 'no-cors',
          body: JSON.stringify({
            campaignId: campaign.id,
            contactId: cc.contactId,
            phone: cc.contact.phone,
            name: cc.contact.name,
            message: campaign.message.replace('{nome}', cc.contact.name),
            timestamp: new Date().toISOString(),
          }),
        });

        updateCampaignContactStatus(campaign.id, cc.contactId, 'sent');
        setRefreshKey(k => k + 1);

        await new Promise(resolve => setTimeout(resolve, 1000));
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

    const updated = getCampaigns().find(c => c.id === campaign.id);
    if (updated && updated.stats.pending === 0) {
      updated.status = 'completed';
      updated.completedAt = new Date();
      updateCampaign(updated);
    }

    setRefreshKey(k => k + 1);
    toast({
      title: "Campanha finalizada",
      description: "Verifique o status dos envios",
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
