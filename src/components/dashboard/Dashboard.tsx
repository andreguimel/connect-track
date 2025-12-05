import { Users, Send, CheckCircle, XCircle, Clock, MessageSquare, Activity } from 'lucide-react';
import { StatsCard } from './StatsCard';
import { RealtimeMetrics } from './RealtimeMetrics';
import { useContacts, useCampaigns, Campaign } from '@/hooks/useData';
import { useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function Dashboard() {
  const { contacts, loading: contactsLoading } = useContacts();
  const { campaigns, loading: campaignsLoading } = useCampaigns();

  const stats = useMemo(() => {
    const totalMessages = campaigns.reduce((acc, c) => acc + c.stats.total, 0);
    const sentMessages = campaigns.reduce((acc, c) => acc + c.stats.sent + c.stats.delivered, 0);
    const deliveredMessages = campaigns.reduce((acc, c) => acc + c.stats.delivered, 0);
    const failedMessages = campaigns.reduce((acc, c) => acc + c.stats.failed, 0);
    const pendingMessages = campaigns.reduce((acc, c) => acc + c.stats.pending, 0);
    
    return {
      totalContacts: contacts.length,
      totalCampaigns: campaigns.length,
      totalMessages,
      sentMessages,
      deliveredMessages,
      failedMessages,
      pendingMessages,
      activeCampaigns: campaigns.filter(c => c.status === 'running').length,
    };
  }, [contacts, campaigns]);

  const recentCampaigns = useMemo(() => {
    return [...campaigns]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [campaigns]);

  if (contactsLoading || campaignsLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Visão geral das suas campanhas de WhatsApp</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="realtime" className="gap-2">
            <Activity className="h-4 w-4" />
            Tempo Real
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard title="Total de Contatos" value={stats.totalContacts} icon={Users} variant="info" />
            <StatsCard title="Mensagens Enviadas" value={stats.sentMessages} subtitle={`de ${stats.totalMessages} total`} icon={Send} variant="success" />
            <StatsCard title="Taxa de Entrega" value={stats.totalMessages > 0 ? `${Math.round((stats.deliveredMessages / Math.max(stats.sentMessages, 1)) * 100)}%` : '0%'} icon={CheckCircle} variant="success" />
            <StatsCard title="Falhas" value={stats.failedMessages} icon={XCircle} variant={stats.failedMessages > 0 ? 'warning' : 'default'} />
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <StatsCard title="Campanhas Ativas" value={stats.activeCampaigns} icon={MessageSquare} />
            <StatsCard title="Mensagens Pendentes" value={stats.pendingMessages} icon={Clock} />
            <StatsCard title="Total de Campanhas" value={stats.totalCampaigns} icon={Send} />
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="font-display text-xl font-semibold text-foreground">Campanhas Recentes</h2>
            <p className="mt-1 text-sm text-muted-foreground">Últimas campanhas criadas</p>
            
            <div className="mt-6">
              {recentCampaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">Nenhuma campanha criada ainda</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentCampaigns.map((campaign) => (
                    <CampaignRow key={campaign.id} campaign={campaign} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="realtime">
          <RealtimeMetrics />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const statusColors = {
    draft: 'bg-secondary text-secondary-foreground',
    running: 'bg-info/10 text-info',
    paused: 'bg-warning/10 text-warning',
    completed: 'bg-success/10 text-success',
  };

  const statusLabels = {
    draft: 'Rascunho',
    running: 'Em execução',
    paused: 'Pausada',
    completed: 'Concluída',
  };

  const progress = campaign.stats.total > 0
    ? Math.round(((campaign.stats.sent + campaign.stats.delivered) / campaign.stats.total) * 100)
    : 0;

  return (
    <div className="flex items-center justify-between rounded-lg border bg-background p-4 transition-all hover:border-primary/30">
      <div className="flex-1">
        <h3 className="font-medium text-foreground">{campaign.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {campaign.stats.total} contatos • Criada em {new Date(campaign.created_at).toLocaleDateString('pt-BR')}
        </p>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="w-32">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium text-foreground">{progress}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-gradient-hero transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
        
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[campaign.status]}`}>
          {statusLabels[campaign.status]}
        </span>
      </div>
    </div>
  );
}