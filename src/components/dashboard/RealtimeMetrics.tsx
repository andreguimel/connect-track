import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Activity, CheckCircle2, XCircle, Clock, Zap, TrendingUp, RefreshCw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface CampaignStats {
  id: string;
  name: string;
  status: string;
  stats: {
    total: number;
    pending: number;
    sent: number;
    delivered: number;
    failed: number;
  };
}

interface RealtimeUpdate {
  id: string;
  contactId: string;
  status: string;
  timestamp: Date;
}

export function RealtimeMetrics() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignStats[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<RealtimeUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fetch campaigns
  useEffect(() => {
    if (!user) return;

    const fetchCampaigns = async () => {
      const { data } = await supabase
        .from('campaigns')
        .select('id, name, status, stats')
        .order('created_at', { ascending: false });
      
      if (data) {
        setCampaigns(data.map(c => ({
          ...c,
          stats: c.stats as CampaignStats['stats']
        })));
      }
    };

    fetchCampaigns();
  }, [user]);

  // Set up realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('realtime-metrics')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'campaign_contacts'
        },
        (payload) => {
          console.log('Realtime update:', payload);
          
          const newUpdate: RealtimeUpdate = {
            id: payload.new.id as string,
            contactId: payload.new.contact_id as string,
            status: payload.new.status as string,
            timestamp: new Date()
          };

          setRecentUpdates(prev => [newUpdate, ...prev].slice(0, 10));
          setLastUpdate(new Date());

          // Update campaign stats locally
          const campaignId = payload.new.campaign_id as string;
          setCampaigns(prev => prev.map(c => {
            if (c.id === campaignId) {
              const oldStatus = (payload.old as { status: string })?.status;
              const newStatus = payload.new.status as string;
              
              const newStats = { ...c.stats };
              
              // Decrement old status
              if (oldStatus === 'pending') newStats.pending = Math.max(0, newStats.pending - 1);
              if (oldStatus === 'sent' || oldStatus === 'sending') newStats.sent = Math.max(0, newStats.sent - 1);
              if (oldStatus === 'delivered') newStats.delivered = Math.max(0, newStats.delivered - 1);
              if (oldStatus === 'failed') newStats.failed = Math.max(0, newStats.failed - 1);
              
              // Increment new status
              if (newStatus === 'pending') newStats.pending++;
              if (newStatus === 'sent' || newStatus === 'sending') newStats.sent++;
              if (newStatus === 'delivered') newStats.delivered++;
              if (newStatus === 'failed') newStats.failed++;
              
              return { ...c, stats: newStats };
            }
            return c;
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'campaigns'
        },
        (payload) => {
          const updatedCampaign = payload.new as CampaignStats;
          setCampaigns(prev => prev.map(c => 
            c.id === updatedCampaign.id 
              ? { ...c, status: updatedCampaign.status, stats: updatedCampaign.stats as CampaignStats['stats'] }
              : c
          ));
          setLastUpdate(new Date());
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const aggregatedStats = useMemo(() => {
    return campaigns.reduce(
      (acc, c) => ({
        total: acc.total + c.stats.total,
        pending: acc.pending + c.stats.pending,
        sent: acc.sent + c.stats.sent,
        delivered: acc.delivered + c.stats.delivered,
        failed: acc.failed + c.stats.failed,
      }),
      { total: 0, pending: 0, sent: 0, delivered: 0, failed: 0 }
    );
  }, [campaigns]);

  const activeCampaigns = campaigns.filter(c => c.status === 'running');
  const deliveryRate = aggregatedStats.delivered + aggregatedStats.sent > 0
    ? Math.round((aggregatedStats.delivered / (aggregatedStats.delivered + aggregatedStats.sent + aggregatedStats.failed)) * 100)
    : 0;

  const statusColors: Record<string, string> = {
    pending: 'bg-muted text-muted-foreground',
    sending: 'bg-info/20 text-info',
    sent: 'bg-primary/20 text-primary',
    delivered: 'bg-success/20 text-success',
    failed: 'bg-destructive/20 text-destructive',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Pendente',
    sending: 'Enviando',
    sent: 'Enviado',
    delivered: 'Entregue',
    failed: 'Falhou',
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-muted'}`} />
          <span className="text-sm text-muted-foreground">
            {isConnected ? 'Conectado em tempo real' : 'Conectando...'}
          </span>
        </div>
        {lastUpdate && (
          <span className="text-xs text-muted-foreground">
            Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
          </span>
        )}
      </div>

      {/* Live Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Total"
          value={aggregatedStats.total}
          icon={Activity}
          color="text-foreground"
        />
        <MetricCard
          label="Pendentes"
          value={aggregatedStats.pending}
          icon={Clock}
          color="text-muted-foreground"
        />
        <MetricCard
          label="Enviados"
          value={aggregatedStats.sent}
          icon={RefreshCw}
          color="text-primary"
          animate={aggregatedStats.sent > 0}
        />
        <MetricCard
          label="Entregues"
          value={aggregatedStats.delivered}
          icon={CheckCircle2}
          color="text-success"
        />
        <MetricCard
          label="Falhas"
          value={aggregatedStats.failed}
          icon={XCircle}
          color="text-destructive"
        />
      </div>

      {/* Progress Overview */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground">Taxa de Entrega Geral</h3>
            <p className="text-sm text-muted-foreground">Baseado em todas as campanhas</p>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-success" />
            <span className="text-2xl font-bold text-foreground">{deliveryRate}%</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <Progress value={deliveryRate} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{aggregatedStats.delivered} entregues</span>
            <span>{aggregatedStats.failed} falhas</span>
          </div>
        </div>
      </div>

      {/* Active Campaigns */}
      {activeCampaigns.length > 0 && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-warning animate-pulse" />
            <h3 className="font-semibold text-foreground">Campanhas Ativas</h3>
            <Badge variant="secondary">{activeCampaigns.length}</Badge>
          </div>
          
          <div className="space-y-4">
            {activeCampaigns.map((campaign) => {
              const progress = campaign.stats.total > 0
                ? Math.round(((campaign.stats.delivered + campaign.stats.sent) / campaign.stats.total) * 100)
                : 0;
              
              return (
                <div key={campaign.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{campaign.name}</span>
                    <span className="text-sm text-muted-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="flex gap-2 text-xs">
                    <span className="text-success">{campaign.stats.delivered} entregues</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-primary">{campaign.stats.sent} enviados</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-destructive">{campaign.stats.failed} falhas</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Updates Feed */}
      {recentUpdates.length > 0 && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Atualizações em Tempo Real</h3>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentUpdates.map((update, index) => (
              <div
                key={`${update.id}-${index}`}
                className="flex items-center justify-between rounded-lg bg-accent/30 px-3 py-2 animate-in slide-in-from-top-2 duration-300"
              >
                <div className="flex items-center gap-2">
                  <Badge className={statusColors[update.status]}>
                    {statusLabels[update.status] || update.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                    Contato atualizado
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {update.timestamp.toLocaleTimeString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  animate?: boolean;
}

function MetricCard({ label, value, icon: Icon, color, animate }: MetricCardProps) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between">
        <Icon className={`h-5 w-5 ${color} ${animate ? 'animate-spin' : ''}`} />
        <span className={`text-2xl font-bold ${color}`}>{value.toLocaleString('pt-BR')}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
