import { useState, useMemo } from 'react';
import { MessageSquare, Play, Pause, Trash2, Eye, Clock, CheckCircle, XCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Campaign } from '@/types/contact';
import { getCampaigns, deleteCampaign, updateCampaign } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CampaignsListProps {
  onStartCampaign: (campaign: Campaign) => void;
}

export function CampaignsList({ onStartCampaign }: CampaignsListProps) {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>(getCampaigns());
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const refreshCampaigns = () => {
    setCampaigns(getCampaigns());
  };

  const handleDelete = (id: string) => {
    deleteCampaign(id);
    refreshCampaigns();
    toast({
      title: "Campanha removida",
      description: "A campanha foi removida com sucesso",
    });
  };

  const handlePause = (campaign: Campaign) => {
    campaign.status = 'paused';
    updateCampaign(campaign);
    refreshCampaigns();
    toast({
      title: "Campanha pausada",
      description: "A campanha foi pausada com sucesso",
    });
  };

  const handleResume = (campaign: Campaign) => {
    onStartCampaign(campaign);
    refreshCampaigns();
  };

  const statusConfig = {
    draft: { label: 'Rascunho', variant: 'secondary' as const, icon: Clock },
    running: { label: 'Em execução', variant: 'default' as const, icon: Play },
    paused: { label: 'Pausada', variant: 'outline' as const, icon: Pause },
    completed: { label: 'Concluída', variant: 'default' as const, icon: CheckCircle },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Campanhas</h1>
        <p className="mt-1 text-muted-foreground">
          Gerencie suas campanhas de envio em massa
        </p>
      </div>

      {/* Campaigns List */}
      <div className="rounded-xl border bg-card shadow-sm">
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <MessageSquare className="h-16 w-16 text-muted-foreground/30" />
            <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
              Nenhuma campanha ainda
            </h3>
            <p className="mt-2 text-center text-muted-foreground">
              Crie uma nova campanha na aba "Enviar"
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {campaigns.map((campaign) => {
              const config = statusConfig[campaign.status];
              const StatusIcon = config.icon;
              const progress = campaign.stats.total > 0
                ? Math.round(((campaign.stats.sent + campaign.stats.delivered) / campaign.stats.total) * 100)
                : 0;

              return (
                <div key={campaign.id} className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-display text-lg font-semibold text-foreground">
                          {campaign.name}
                        </h3>
                        <Badge variant={config.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </div>
                      
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {campaign.message}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Send className="h-4 w-4 text-muted-foreground" />
                          <span className="text-foreground">{campaign.stats.total}</span>
                          <span className="text-muted-foreground">contatos</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-success" />
                          <span className="text-foreground">{campaign.stats.delivered}</span>
                          <span className="text-muted-foreground">entregues</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-destructive" />
                          <span className="text-foreground">{campaign.stats.failed}</span>
                          <span className="text-muted-foreground">falhas</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-4 max-w-md">
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
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSelectedCampaign(campaign)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      {campaign.status === 'draft' && (
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
              {/* Message Preview */}
              <div className="rounded-lg border bg-accent/30 p-4">
                <p className="text-sm font-medium text-foreground">Mensagem:</p>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                  {selectedCampaign.message}
                </p>
              </div>

              {/* Contacts Status Table */}
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
                  {selectedCampaign.contacts.map((cc) => (
                    <TableRow key={cc.contactId}>
                      <TableCell className="font-medium">{cc.contact.name}</TableCell>
                      <TableCell className="font-mono text-sm">{cc.contact.phone}</TableCell>
                      <TableCell>
                        <StatusBadge status={cc.status} error={cc.error} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cc.sentAt ? cc.sentAt.toLocaleString('pt-BR') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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
