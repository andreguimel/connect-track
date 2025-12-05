import { useState, useMemo, useCallback } from 'react';
import { Send, Users, MessageSquare, Check, AlertCircle, Loader2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Contact, Campaign, ContactGroup } from '@/types/contact';
import { getContacts, createCampaign, updateCampaign, getCampaigns, updateCampaignContactStatus, getGroups } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SendMessageProps {
  webhookUrl: string;
  onCampaignCreated: () => void;
}

export function SendMessage({ webhookUrl, onCampaignCreated }: SendMessageProps) {
  const { toast } = useToast();
  const [contacts] = useState<Contact[]>(getContacts());
  const [groups] = useState<ContactGroup[]>(getGroups());
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');

  const filteredContacts = useMemo(() => {
    let filtered = contacts;
    
    if (selectedGroupFilter !== 'all') {
      if (selectedGroupFilter === 'none') {
        filtered = filtered.filter(c => !c.groupId);
      } else {
        filtered = filtered.filter(c => c.groupId === selectedGroupFilter);
      }
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        c => c.name.toLowerCase().includes(term) || c.phone.includes(term)
      );
    }
    
    return filtered;
  }, [contacts, searchTerm, selectedGroupFilter]);

  const getGroupById = (groupId: string | undefined) => {
    if (!groupId) return null;
    return groups.find(g => g.id === groupId);
  };

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
    if (selectedContactIds.size === filteredContacts.length && filteredContacts.length > 0) {
      // Deselect all filtered
      const newSelected = new Set(selectedContactIds);
      filteredContacts.forEach(c => newSelected.delete(c.id));
      setSelectedContactIds(newSelected);
    } else {
      // Select all filtered
      const newSelected = new Set(selectedContactIds);
      filteredContacts.forEach(c => newSelected.add(c.id));
      setSelectedContactIds(newSelected);
    }
  };

  const selectGroupOnly = (groupId: string) => {
    const groupContacts = contacts.filter(c => 
      groupId === 'none' ? !c.groupId : c.groupId === groupId
    );
    setSelectedContactIds(new Set(groupContacts.map(c => c.id)));
    setSelectedGroupFilter(groupId);
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

  const filteredSelectedCount = filteredContacts.filter(c => selectedContactIds.has(c.id)).length;

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
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex gap-2">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar contatos..."
                  className="flex-1"
                />
                <Button variant="outline" onClick={toggleAll}>
                  {filteredSelectedCount === filteredContacts.length && filteredContacts.length > 0 ? 'Desmarcar' : 'Selecionar'} Todos
                </Button>
              </div>
              
              {/* Group Filter */}
              <div className="flex gap-2 items-center">
                <Select value={selectedGroupFilter} onValueChange={setSelectedGroupFilter}>
                  <SelectTrigger className="flex-1">
                    <Tag className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Filtrar por grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os grupos</SelectItem>
                    <SelectItem value="none">Sem grupo</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${group.color}`} />
                          {group.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedGroupFilter !== 'all' && (
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => selectGroupOnly(selectedGroupFilter)}
                  >
                    Selecionar Grupo
                  </Button>
                )}
              </div>

              {/* Quick Group Selection */}
              {groups.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {groups.map((group) => {
                    const groupCount = contacts.filter(c => c.groupId === group.id).length;
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => selectGroupOnly(group.id)}
                        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-accent"
                      >
                        <div className={`h-2.5 w-2.5 rounded-full ${group.color}`} />
                        {group.name} ({groupCount})
                      </button>
                    );
                  })}
                </div>
              )}
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
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Tag className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 text-muted-foreground">
                  Nenhum contato neste grupo
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredContacts.map((contact) => {
                  const group = getGroupById(contact.groupId);
                  return (
                    <label
                      key={contact.id}
                      className="flex cursor-pointer items-center gap-4 p-4 transition-colors hover:bg-accent/50"
                    >
                      <Checkbox
                        checked={selectedContactIds.has(contact.id)}
                        onCheckedChange={() => toggleContact(contact.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground truncate">{contact.name}</p>
                          {group && (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${group.color} text-white`}>
                              {group.name}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{contact.phone}</p>
                      </div>
                      {selectedContactIds.has(contact.id) && (
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}