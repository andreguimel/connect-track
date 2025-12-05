import { useState } from 'react';
import { FileDown, FileSpreadsheet, FileText, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useCampaigns, Campaign } from '@/hooks/useData';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface CampaignContactDetail {
  id: string;
  contact_id: string;
  status: string;
  error?: string;
  sent_at?: string;
  contact?: {
    name: string;
    phone: string;
  };
}

export function ExportReports() {
  const { toast } = useToast();
  const { campaigns } = useCampaigns();
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [includeContacts, setIncludeContacts] = useState(true);

  const filteredCampaigns = campaigns.filter(c => {
    if (dateFrom && new Date(c.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(c.created_at) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  const toggleCampaign = (id: string) => {
    const newSelected = new Set(selectedCampaigns);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedCampaigns(newSelected);
  };

  const selectAll = () => {
    if (selectedCampaigns.size === filteredCampaigns.length) {
      setSelectedCampaigns(new Set());
    } else {
      setSelectedCampaigns(new Set(filteredCampaigns.map(c => c.id)));
    }
  };

  const fetchCampaignContacts = async (campaignId: string): Promise<CampaignContactDetail[]> => {
    const { data } = await supabase
      .from('campaign_contacts')
      .select(`
        id,
        contact_id,
        status,
        error,
        sent_at,
        contacts (
          name,
          phone
        )
      `)
      .eq('campaign_id', campaignId);

    return (data || []).map(item => ({
      id: item.id,
      contact_id: item.contact_id,
      status: item.status,
      error: item.error || undefined,
      sent_at: item.sent_at || undefined,
      contact: item.contacts as { name: string; phone: string } | undefined
    }));
  };

  const getSelectedCampaignsData = () => {
    return campaigns.filter(c => selectedCampaigns.has(c.id));
  };

  const calculateTotals = (campaignsData: Campaign[]) => {
    return campaignsData.reduce(
      (acc, c) => ({
        total: acc.total + c.stats.total,
        pending: acc.pending + c.stats.pending,
        sent: acc.sent + c.stats.sent,
        delivered: acc.delivered + c.stats.delivered,
        failed: acc.failed + c.stats.failed,
      }),
      { total: 0, pending: 0, sent: 0, delivered: 0, failed: 0 }
    );
  };

  const statusLabels: Record<string, string> = {
    pending: 'Pendente',
    sending: 'Enviando',
    sent: 'Enviado',
    delivered: 'Entregue',
    failed: 'Falhou',
    draft: 'Rascunho',
    running: 'Em execução',
    paused: 'Pausada',
    completed: 'Concluída',
    scheduled: 'Agendada',
  };

  const exportToPDF = async () => {
    if (selectedCampaigns.size === 0) {
      toast({ title: "Selecione campanhas", description: "Selecione pelo menos uma campanha para exportar", variant: "destructive" });
      return;
    }

    setIsExporting(true);
    
    try {
      const campaignsData = getSelectedCampaignsData();
      const totals = calculateTotals(campaignsData);
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text('Relatório de Campanhas', pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, 28, { align: 'center' });
      
      // Summary
      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text('Resumo Geral', 14, 42);
      
      autoTable(doc, {
        startY: 46,
        head: [['Métrica', 'Valor']],
        body: [
          ['Total de Campanhas', selectedCampaigns.size.toString()],
          ['Total de Mensagens', totals.total.toString()],
          ['Entregues', totals.delivered.toString()],
          ['Enviados', totals.sent.toString()],
          ['Pendentes', totals.pending.toString()],
          ['Falhas', totals.failed.toString()],
          ['Taxa de Entrega', totals.total > 0 ? `${Math.round((totals.delivered / totals.total) * 100)}%` : '0%'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
      });
      
      // Campaigns table
      let currentY = (doc as any).lastAutoTable.finalY + 15;
      
      doc.setFontSize(14);
      doc.text('Detalhes das Campanhas', 14, currentY);
      
      autoTable(doc, {
        startY: currentY + 4,
        head: [['Nome', 'Status', 'Total', 'Entregues', 'Enviados', 'Falhas', 'Criada em']],
        body: campaignsData.map(c => [
          c.name,
          statusLabels[c.status] || c.status,
          c.stats.total.toString(),
          c.stats.delivered.toString(),
          c.stats.sent.toString(),
          c.stats.failed.toString(),
          new Date(c.created_at).toLocaleDateString('pt-BR'),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
          0: { cellWidth: 50 },
        },
      });
      
      // Contact details per campaign
      if (includeContacts) {
        for (const campaign of campaignsData) {
          const contacts = await fetchCampaignContacts(campaign.id);
          if (contacts.length === 0) continue;
          
          doc.addPage();
          doc.setFontSize(14);
          doc.text(`Contatos - ${campaign.name}`, 14, 20);
          
          autoTable(doc, {
            startY: 26,
            head: [['Nome', 'Telefone', 'Status', 'Erro', 'Enviado em']],
            body: contacts.map(c => [
              c.contact?.name || 'N/A',
              c.contact?.phone || 'N/A',
              statusLabels[c.status] || c.status,
              c.error || '-',
              c.sent_at ? new Date(c.sent_at).toLocaleString('pt-BR') : '-',
            ]),
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246] },
          });
        }
      }
      
      doc.save(`relatorio-campanhas-${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({ title: "PDF exportado", description: "O relatório foi baixado com sucesso" });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({ title: "Erro na exportação", description: "Não foi possível gerar o PDF", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToExcel = async () => {
    if (selectedCampaigns.size === 0) {
      toast({ title: "Selecione campanhas", description: "Selecione pelo menos uma campanha para exportar", variant: "destructive" });
      return;
    }

    setIsExporting(true);
    
    try {
      const campaignsData = getSelectedCampaignsData();
      const totals = calculateTotals(campaignsData);
      
      const workbook = XLSX.utils.book_new();
      
      // Summary sheet
      const summaryData = [
        ['Relatório de Campanhas'],
        [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
        [],
        ['Resumo Geral'],
        ['Métrica', 'Valor'],
        ['Total de Campanhas', selectedCampaigns.size],
        ['Total de Mensagens', totals.total],
        ['Entregues', totals.delivered],
        ['Enviados', totals.sent],
        ['Pendentes', totals.pending],
        ['Falhas', totals.failed],
        ['Taxa de Entrega', totals.total > 0 ? `${Math.round((totals.delivered / totals.total) * 100)}%` : '0%'],
      ];
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');
      
      // Campaigns sheet
      const campaignsSheetData = [
        ['Nome', 'Status', 'Total', 'Entregues', 'Enviados', 'Pendentes', 'Falhas', 'Taxa de Entrega', 'Criada em', 'Concluída em'],
        ...campaignsData.map(c => [
          c.name,
          statusLabels[c.status] || c.status,
          c.stats.total,
          c.stats.delivered,
          c.stats.sent,
          c.stats.pending,
          c.stats.failed,
          c.stats.total > 0 ? `${Math.round((c.stats.delivered / c.stats.total) * 100)}%` : '0%',
          new Date(c.created_at).toLocaleDateString('pt-BR'),
          c.completed_at ? new Date(c.completed_at).toLocaleDateString('pt-BR') : '-',
        ])
      ];
      
      const campaignsSheet = XLSX.utils.aoa_to_sheet(campaignsSheetData);
      XLSX.utils.book_append_sheet(workbook, campaignsSheet, 'Campanhas');
      
      // Contact details sheet
      if (includeContacts) {
        const allContacts: any[][] = [
          ['Campanha', 'Nome do Contato', 'Telefone', 'Status', 'Erro', 'Enviado em']
        ];
        
        for (const campaign of campaignsData) {
          const contacts = await fetchCampaignContacts(campaign.id);
          contacts.forEach(c => {
            allContacts.push([
              campaign.name,
              c.contact?.name || 'N/A',
              c.contact?.phone || 'N/A',
              statusLabels[c.status] || c.status,
              c.error || '-',
              c.sent_at ? new Date(c.sent_at).toLocaleString('pt-BR') : '-',
            ]);
          });
        }
        
        const contactsSheet = XLSX.utils.aoa_to_sheet(allContacts);
        XLSX.utils.book_append_sheet(workbook, contactsSheet, 'Contatos');
      }
      
      XLSX.writeFile(workbook, `relatorio-campanhas-${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast({ title: "Excel exportado", description: "O relatório foi baixado com sucesso" });
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast({ title: "Erro na exportação", description: "Não foi possível gerar o Excel", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileDown className="h-4 w-4" />
          Exportar Relatório
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Exportar Relatório de Campanhas</DialogTitle>
          <DialogDescription>
            Selecione as campanhas e o formato do relatório
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Filters */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-from">Data inicial</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-to">Data final</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Campaign Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Campanhas ({selectedCampaigns.size} selecionadas)</Label>
              <Button variant="ghost" size="sm" onClick={selectAll}>
                {selectedCampaigns.size === filteredCampaigns.length ? 'Desmarcar todas' : 'Selecionar todas'}
              </Button>
            </div>
            
            <div className="max-h-48 overflow-y-auto rounded-lg border bg-background p-2 space-y-1">
              {filteredCampaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma campanha encontrada no período
                </p>
              ) : (
                filteredCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center gap-3 rounded-md p-2 hover:bg-accent/50 cursor-pointer"
                    onClick={() => toggleCampaign(campaign.id)}
                  >
                    <Checkbox
                      checked={selectedCampaigns.has(campaign.id)}
                      onCheckedChange={() => toggleCampaign(campaign.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {campaign.stats.total} contatos • {new Date(campaign.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      campaign.status === 'completed' ? 'bg-success/10 text-success' :
                      campaign.status === 'running' ? 'bg-info/10 text-info' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {statusLabels[campaign.status] || campaign.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-contacts"
              checked={includeContacts}
              onCheckedChange={(checked) => setIncludeContacts(checked as boolean)}
            />
            <Label htmlFor="include-contacts" className="cursor-pointer">
              Incluir detalhes dos contatos
            </Label>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-3">
            <Button
              className="flex-1 gap-2"
              onClick={exportToPDF}
              disabled={isExporting || selectedCampaigns.size === 0}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Exportar PDF
            </Button>
            <Button
              className="flex-1 gap-2"
              variant="outline"
              onClick={exportToExcel}
              disabled={isExporting || selectedCampaigns.size === 0}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Exportar Excel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
