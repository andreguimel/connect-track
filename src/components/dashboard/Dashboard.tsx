import { Users, Send, CheckCircle, XCircle, Clock, MessageSquare } from 'lucide-react';
import { StatsCard } from './StatsCard';
import { getCampaigns, getContacts } from '@/lib/storage';
import { useMemo } from 'react';
import { Campaign } from '@/types/contact';

export function Dashboard() {
  const stats = useMemo(() => {
    const contacts = getContacts();
    const campaigns = getCampaigns();
    
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
  }, []);

  const recentCampaigns = useMemo(() => {
    return getCampaigns()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Visão geral das suas campanhas de WhatsApp
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total de Contatos"
          value={stats.totalContacts}
          icon={Users}
          variant="info"
        />
        <StatsCard
          title="Mensagens Enviadas"
          value={stats.sentMessages}
          subtitle={`de ${stats.totalMessages} total`}
          icon={Send}
          variant="success"
        />
        <StatsCard
          title="Taxa de Entrega"
          value={stats.totalMessages > 0 
            ? `${Math.round((stats.deliveredMessages / Math.max(stats.sentMessages, 1)) * 100)}%`
            : '0%'
          }
          icon={CheckCircle}
          variant="success"
        />
        <StatsCard
          title="Falhas"
          value={stats.failedMessages}
          icon={XCircle}
          variant={stats.failedMessages > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-6 sm:grid-cols-3">
        <StatsCard
          title="Campanhas Ativas"
          value={stats.activeCampaigns}
          icon={MessageSquare}
        />
        <StatsCard
          title="Mensagens Pendentes"
          value={stats.pendingMessages}
          icon={Clock}
        />
        <StatsCard
          title="Total de Campanhas"
          value={stats.totalCampaigns}
          icon={Send}
        />
      </div>

      {/* Recent Campaigns */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Campanhas Recentes
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Últimas campanhas criadas
        </p>
        
        <div className="mt-6">
          {recentCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                Nenhuma campanha criada ainda
              </p>
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
          {campaign.stats.total} contatos • Criada em {campaign.createdAt.toLocaleDateString('pt-BR')}
        </p>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Progress bar */}
        <div className="w-32">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium text-foreground">{progress}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
            <div 
              className="h-full rounded-full bg-gradient-hero transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        {/* Status badge */}
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[campaign.status]}`}>
          {statusLabels[campaign.status]}
        </span>
      </div>
    </div>
  );
}
