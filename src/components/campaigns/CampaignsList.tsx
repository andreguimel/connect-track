import { useState } from 'react';
import { MessageSquare, Play, Pause, Trash2, Eye, Clock, CheckCircle, XCircle, Send, Calendar, Image, Video, Music, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCampaigns, Campaign, CampaignContact } from '@/hooks/useData';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

interface CampaignsListProps {
  onStartCampaign: (campaign: Campaign, contactFilter?: 'all' | 'failed') => void;
}

export function CampaignsList({ onStartCampaign }: CampaignsListProps) {
  const { toast } = useToast();
  const { campaigns, loading, deleteCampaign, updateCampaign, getCampaignContacts } = useCampaigns();
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignContacts, setCampaignContacts] = useState<CampaignContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [resendCampaign, setResendCampaign] = useState<Campaign | null>(null);
  const [resendLoading, setResendLoading] = useState(false);

  const handleViewCampaign = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setLoadingContacts(true);
    const contacts = await getCampaignContacts(campaign.id);
    setCampaignContacts(contacts as CampaignContact[]);
    setLoadingContacts(false);
  };

  const handleDelete = async (id: string) => {
    await deleteCampaign(id);
    toast({
      title: "Campanha removida",
      description: "A campanha foi removida com sucesso",
    });
  };

  const handlePause = async (campaign: Campaign) => {
    await updateCampaign(campaign.id, { status: 'paused' });
    toast({
      title: "Campanha pausada",
      description: "A campanha foi pausada com sucesso",
    });
  };

  const handleResume = (campaign: Campaign) => {
    onStartCampaign(campaign);
  };

  const handleResend = async (campaign: Campaign, filter: 'all' | 'failed') => {
    setResendLoading(true);
    try {
      if (filter === 'all') {
        // Reset all contacts to pending
        await supabase
          .from('campaign_contacts')
          .update({ status: 'pending', error: null, sent_at: null })
          .eq('campaign_id', campaign.id);
      } else {
        // Reset only failed contacts to pending
        await supabase
          .from('campaign_contacts')
          .update({ status: 'pending', error: null, sent_at: null })
          .eq('campaign_id', campaign.id)
          .eq('status', 'failed');
      }

      // Get updated contact count
      const { count: totalCount } = await supabase
        .from('campaign_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending');

      // Update campaign stats and status
      const newStats = {
        ...campaign.stats,
        pending: totalCount || 0,
        sent: filter === 'all' ? 0 : campaign.stats.sent,
        delivered: filter === 'all' ? 0 : campaign.stats.delivered,
        failed: filter === 'all' ? 0 : 0,
      };

      await updateCampaign(campaign.id, { 
        status: 'draft',
        stats: newStats,
        completed_at: null
      });

      setResendCampaign(null);
      
      toast({
        title: "Campanha preparada para reenvio",
        description: filter === 'all' 
          ? "Todos os contatos foram resetados. Clique em Iniciar para enviar."
          : "Contatos com falha foram resetados. Clique em Iniciar para reenviar.",
      });

      // Start the campaign
      onStartCampaign({ ...campaign, status: 'draft', stats: newStats }, filter);
    } catch (error) {
      console.error('Error preparing resend:', error);
      toast({
        title: "Erro ao preparar reenvio",
        description: "Não foi possível preparar a campanha para reenvio",
        variant: "destructive",
      });
    } finally {
      setResendLoading(false);
    }
  };

  const statusConfig = {
    draft: { label: 'Rascunho', variant: 'secondary' as const, icon: Clock },
    scheduled: { label: 'Agendada', variant: 'outline' as const, icon: Calendar },
    running: { label: 'Em execução', variant: 'default' as const, icon: Play },
    paused: { label: 'Pausada', variant: 'outline' as const, icon: Pause },
    completed: { label: 'Concluída', variant: 'default' as const, icon: CheckCircle },
  };

  const mediaIcons = {
    image: Image,
    video: Video,
    audio: Music,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Campanhas</h1>
        <p className="mt-1 text-sm md:text-base text-muted-foreground">
          Gerencie suas campanhas de envio em massa
        </p>
      </div>

      {/* Campaigns List */}
      <div className="rounded-xl border bg-card shadow-sm">
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 md:py-16">
            <MessageSquare className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground/30" />
            <h3 className="mt-4 font-display text-base md:text-lg font-semibold text-foreground">
              Nenhuma campanha ainda
            </h3>
            <p className="mt-2 text-center text-sm text-muted-foreground px-4">
              Crie uma nova campanha na aba "Enviar"
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {campaigns.map((campaign) => {
              const config = statusConfig[campaign.status];
              const StatusIcon = config.icon;
              const MediaIcon = campaign.media_type ? mediaIcons[campaign.media_type] : null;
              const progress = campaign.stats.total > 0
                ? Math.round(((campaign.stats.sent + campaign.stats.delivered) / campaign.stats.total) * 100)
                : 0;

              return (
                <div key={campaign.id} className="p-4 md:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display text-base md:text-lg font-semibold text-foreground truncate">
                          {campaign.name}
                        </h3>
                        <Badge variant={config.variant} className="gap-1 shrink-0 text-xs">
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                        {MediaIcon && (
                          <Badge variant="outline" className="gap-1 shrink-0 text-xs">
                            <MediaIcon className="h-3 w-3" />
                            <span className="hidden sm:inline">
                              {campaign.media_type === 'image' ? 'Imagem' : campaign.media_type === 'video' ? 'Vídeo' : 'Áudio'}
                            </span>
                          </Badge>
                        )}
                      </div>
                      
                      <p className="mt-2 line-clamp-2 text-xs md:text-sm text-muted-foreground">
                        {campaign.message}
                      </p>

                      {campaign.scheduled_at && (
                        <div className="mt-2 flex items-center gap-2 text-xs md:text-sm text-info">
                          <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          Agendada: {format(new Date(campaign.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      )}

                      <div className="mt-3 md:mt-4 flex flex-wrap gap-3 md:gap-4 text-xs md:text-sm">
                        <div className="flex items-center gap-1.5 md:gap-2">
                          <Send className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                          <span className="text-foreground">{campaign.stats.total}</span>
                          <span className="text-muted-foreground hidden sm:inline">contatos</span>
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-2">
                          <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4 text-success" />
                          <span className="text-foreground">{campaign.stats.delivered}</span>
                          <span className="text-muted-foreground hidden sm:inline">entregues</span>
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-2">
                          <XCircle className="h-3.5 w-3.5 md:h-4 md:w-4 text-destructive" />
                          <span className="text-foreground">{campaign.stats.failed}</span>
                          <span className="text-muted-foreground hidden sm:inline">falhas</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3 md:mt-4 max-w-md">
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
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleViewCampaign(campaign)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                        <Button
                          variant="default"
                          size="icon"
                          onClick={() => onStartCampaign(campaign)}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {campaign.status === 'running' && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handlePause(campaign)}
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {campaign.status === 'paused' && (
                        <Button
                          variant="default"
                          size="icon"
                          onClick={() => handleResume(campaign)}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}

                      {campaign.status === 'completed' && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setResendCampaign(campaign)}
                          title="Reenviar campanha"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(campaign.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Campaign Details Dialog */}
      <Dialog open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCampaign?.name}</DialogTitle>
            <DialogDescription>
              Detalhes e status de envio da campanha
            </DialogDescription>
          </DialogHeader>
          
          {selectedCampaign && (
            <div className="space-y-6">
              {/* Media Preview */}
              {selectedCampaign.media_url && (
                <div className="rounded-lg border bg-accent/30 p-4">
                  <p className="text-sm font-medium text-foreground mb-2">Mídia anexada:</p>
                  {selectedCampaign.media_type === 'image' && (
                    <img src={selectedCampaign.media_url} alt="Mídia da campanha" className="max-h-48 rounded-lg object-cover" />
                  )}
                  {selectedCampaign.media_type === 'video' && (
                    <video src={selectedCampaign.media_url} controls className="max-h-48 rounded-lg" />
                  )}
                  {selectedCampaign.media_type === 'audio' && (
                    <audio src={selectedCampaign.media_url} controls className="w-full" />
                  )}
                </div>
              )}

              {/* Message Preview */}
              <div className="rounded-lg border bg-accent/30 p-4">
                <p className="text-sm font-medium text-foreground">Mensagem:</p>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                  {selectedCampaign.message}
                </p>
              </div>

              {/* Contacts Status Table */}
              {loadingContacts ? (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Enviado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignContacts.map((cc) => (
                      <TableRow key={cc.id}>
                        <TableCell className="font-medium">{cc.contact?.name || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">{cc.contact?.phone || '-'}</TableCell>
                        <TableCell>
                          <StatusBadge status={cc.status} error={cc.error} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {cc.sent_at ? format(new Date(cc.sent_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resend Dialog */}
      <Dialog open={!!resendCampaign} onOpenChange={() => setResendCampaign(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reenviar Campanha</DialogTitle>
            <DialogDescription>
              Escolha para quais contatos deseja reenviar a campanha "{resendCampaign?.name}"
            </DialogDescription>
          </DialogHeader>
          
          {resendCampaign && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-center text-sm">
                <div className="rounded-lg border bg-accent/30 p-3">
                  <p className="text-2xl font-bold text-foreground">{resendCampaign.stats.total}</p>
                  <p className="text-muted-foreground">Total</p>
                </div>
                <div className="rounded-lg border bg-destructive/10 p-3">
                  <p className="text-2xl font-bold text-destructive">{resendCampaign.stats.failed}</p>
                  <p className="text-muted-foreground">Falhas</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setResendCampaign(null)}
              disabled={resendLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={() => resendCampaign && handleResend(resendCampaign, 'failed')}
              disabled={resendLoading || !resendCampaign?.stats.failed}
            >
              {resendLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Apenas Falhas ({resendCampaign?.stats.failed || 0})
            </Button>
            <Button
              onClick={() => resendCampaign && handleResend(resendCampaign, 'all')}
              disabled={resendLoading}
            >
              {resendLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Todos ({resendCampaign?.stats.total || 0})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status, error }: { status: string; error?: string }) {
  const config = {
    pending: { label: 'Pendente', className: 'bg-secondary text-secondary-foreground' },
    sending: { label: 'Enviando', className: 'bg-info/10 text-info' },
    sent: { label: 'Enviado', className: 'bg-success/10 text-success' },
    delivered: { label: 'Entregue', className: 'bg-success/10 text-success' },
    failed: { label: 'Falhou', className: 'bg-destructive/10 text-destructive' },
  }[status] || { label: status, className: 'bg-secondary text-secondary-foreground' };

  return (
    <span 
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
      title={error}
    >
      {config.label}
    </span>
  );
}