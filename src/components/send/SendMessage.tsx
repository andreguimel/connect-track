import { useState, useMemo, useCallback } from 'react';
import { Send, Users, MessageSquare, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Contact, Campaign } from '@/types/contact';
import { getContacts, createCampaign, updateCampaign, getCampaigns, updateCampaignContactStatus } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';

interface SendMessageProps {
  webhookUrl: string;
  onCampaignCreated: () => void;
}

export function SendMessage({ webhookUrl, onCampaignCreated }: SendMessageProps) {
  const { toast } = useToast();
  const [contacts] = useState<Contact[]>(getContacts());
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredContacts = useMemo(() => {
    if (!searchTerm) return contacts;
    const term = searchTerm.toLowerCase();
    return contacts.filter(
      c => c.name.toLowerCase().includes(term) || c.phone.includes(term)
    );
  }, [contacts, searchTerm]);

  const toggleContact = (id: string) => {
    const newSelected = new Set(selectedContactIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedContactIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedContactIds.size === filteredContacts.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const sendViaWebhook = async (campaign: Campaign) => {
    if (!webhookUrl) {
      toast({
        title: "Webhook não configurado",
        description: "Configure o webhook do n8n nas configurações",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    campaign.status = 'running';
    updateCampaign(campaign);

    for (const cc of campaign.contacts) {
      if (cc.status !== 'pending') continue;

      try {
        // Update status to sending
        updateCampaignContactStatus(campaign.id, cc.contactId, 'sending');

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          mode: 'no-cors',
          body: JSON.stringify({
            campaignId: campaign.id,
            contactId: cc.contactId,
            phone: cc.contact.phone,
            name: cc.contact.name,
            message: campaign.message,
            timestamp: new Date().toISOString(),
          }),
        });

        // Since we use no-cors, we assume success
        updateCampaignContactStatus(campaign.id, cc.contactId, 'sent');

        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Error sending message:', error);
        updateCampaignContactStatus(
          campaign.id, 
          cc.contactId, 
          'failed',
          error instanceof Error ? error.message : 'Erro desconhecido'
        );
      }
    }

    // Update final campaign status
    const updatedCampaign = getCampaigns().find(c => c.id === campaign.id);
    if (updatedCampaign && updatedCampaign.stats.pending === 0) {
      updatedCampaign.status = 'completed';
      updatedCampaign.completedAt = new Date();
      updateCampaign(updatedCampaign);
    }

    setIsSending(false);
    toast({
      title: "Campanha finalizada",
      description: "Verifique o status dos envios na aba Campanhas",
    });
    onCampaignCreated();
  };

  const handleCreateCampaign = useCallback(() => {
    if (!campaignName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe um nome para a campanha",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Mensagem obrigatória",
        description: "Escreva a mensagem que será enviada",
        variant: "destructive",
      });
      return;
    }

    if (selectedContactIds.size === 0) {
      toast({
        title: "Selecione contatos",
        description: "Selecione pelo menos um contato para enviar",
        variant: "destructive",
      });
      return;
    }

    const campaign = createCampaign(
      campaignName,
      message,
      Array.from(selectedContactIds)
    );

    toast({
      title: "Campanha criada",
      description: `Campanha "${campaignName}" criada com ${selectedContactIds.size} contatos`,
    });

    // Start sending
    sendViaWebhook(campaign);

    // Reset form
    setCampaignName('');
    setMessage('');
    setSelectedContactIds(new Set());
  }, [campaignName, message, selectedContactIds, webhookUrl, toast, onCampaignCreated]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Enviar Mensagem</h1>
        <p className="mt-1 text-muted-foreground">
          Crie e envie campanhas de WhatsApp em massa
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Form */}
        <div className="space-y-6">
          {/* Campaign Name */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Nome da Campanha</Label>
                <Input
                  id="campaign-name"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Ex: Promoção Black Friday"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Mensagem</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Digite sua mensagem aqui...&#10;&#10;Use {nome} para personalizar com o nome do contato"
                  className="min-h-[150px]"
                />
                <p className="text-xs text-muted-foreground">
                  Variáveis disponíveis: {'{nome}'} - nome do contato
                </p>
              </div>
            </div>
          </div>

          {/* Preview */}
          {message && (
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h3 className="font-medium text-foreground">Prévia da Mensagem</h3>
              <div className="mt-4 rounded-lg bg-accent p-4">
                <p className="whitespace-pre-wrap text-sm text-accent-foreground">
                  {message.replace('{nome}', 'João')}
                </p>
              </div>
            </div>
          )}

          {/* Send Button */}
          <Button
            size="xl"
            className="w-full"
            onClick={handleCreateCampaign}
            disabled={isSending || !webhookUrl}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-5 w-5" />
                Criar e Enviar Campanha ({selectedContactIds.size} contatos)
              </>
            )}
          </Button>

          {!webhookUrl && (
            <div className="flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning">
              <AlertCircle className="h-4 w-4" />
              Configure o webhook do n8n nas Configurações
            </div>
          )}
        </div>

        {/* Right: Contact Selection */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="border-b p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="font-medium text-foreground">Selecionar Contatos</h3>
              </div>
              <span className="text-sm text-muted-foreground">
                {selectedContactIds.size} de {contacts.length} selecionados
              </span>
            </div>
            <div className="mt-4 flex gap-2">
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar contatos..."
                className="flex-1"
              />
              <Button variant="outline" onClick={toggleAll}>
                {selectedContactIds.size === filteredContacts.length ? 'Desmarcar' : 'Selecionar'} Todos
              </Button>
            </div>
          </div>

          <div className="max-h-[500px] overflow-y-auto">
            {contacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 text-muted-foreground">
                  Nenhum contato disponível
                </p>
                <p className="text-sm text-muted-foreground">
                  Importe contatos na aba Contatos
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredContacts.map((contact) => (
                  <label
                    key={contact.id}
                    className="flex cursor-pointer items-center gap-4 p-4 transition-colors hover:bg-accent/50"
                  >
                    <Checkbox
                      checked={selectedContactIds.has(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">{contact.phone}</p>
                    </div>
                    {selectedContactIds.has(contact.id) && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
