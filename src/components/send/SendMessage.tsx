import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Send, Users, Check, AlertCircle, Loader2, Tag, FileText, Calendar, Image, Video, Music, X, Upload, Wifi, Users2, RefreshCw, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useContacts, useGroups, useTemplates, useCampaigns, Campaign } from '@/hooks/useData';
import { useEvolutionInstances, EvolutionInstance } from '@/hooks/useEvolutionInstances';
import { useWhatsAppGroups, WhatsAppGroup } from '@/hooks/useWhatsAppGroups';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { getAntiBanSettings, getRandomDelay } from '@/lib/antiban';
import { WhatsAppPreview } from './WhatsAppPreview';
import { SendConfirmationDialog } from './SendConfirmationDialog';
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
  const { contacts } = useContacts();
  const { groups } = useGroups();
  const { templates } = useTemplates();
  const { createCampaign, updateCampaign, getCampaignContacts, updateCampaignContactStatus, uploadCampaignMedia } = useCampaigns();
  const { instances } = useEvolutionInstances();
  const { groups: whatsappGroups, syncing, syncGroups, fetchGroups } = useWhatsAppGroups();
  const { canCreateCampaign, getLimits, hasAccess, isSubscriptionActive, loading: subscriptionLoading } = useSubscription();
  
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [selectedGroupJids, setSelectedGroupJids] = useState<Set<string>>(new Set());
  const [recipientTab, setRecipientTab] = useState<string>('contacts');
  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState({ current: 0, total: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  
  // Scheduling
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  
  // Media
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | 'document' | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Phantom mentions (for groups)
  const [mentionEveryone, setMentionEveryone] = useState(false);

  // Set default instance when instances load
  useEffect(() => {
    if (instances.length > 0 && !selectedInstanceId) {
      const connected = instances.find(i => i.status === 'connected');
      setSelectedInstanceId(connected?.id || instances[0].id);
    }
  }, [instances, selectedInstanceId]);

  // Fetch WhatsApp groups when instance changes
  useEffect(() => {
    if (selectedInstanceId) {
      fetchGroups(selectedInstanceId);
    }
  }, [selectedInstanceId, fetchGroups]);

  const connectedInstances = useMemo(() => 
    instances.filter(i => i.status === 'connected'), 
    [instances]
  );

  const filteredContacts = useMemo(() => {
    let filtered = contacts;
    
    if (selectedGroupFilter !== 'all') {
      if (selectedGroupFilter === 'none') {
        filtered = filtered.filter(c => !c.group_id);
      } else {
        filtered = filtered.filter(c => c.group_id === selectedGroupFilter);
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

  const filteredWhatsAppGroups = useMemo(() => {
    if (!searchTerm) return whatsappGroups;
    const term = searchTerm.toLowerCase();
    return whatsappGroups.filter(g => g.name.toLowerCase().includes(term));
  }, [whatsappGroups, searchTerm]);

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

  const toggleWhatsAppGroup = (jid: string) => {
    const newSelected = new Set(selectedGroupJids);
    if (newSelected.has(jid)) {
      newSelected.delete(jid);
    } else {
      newSelected.add(jid);
    }
    setSelectedGroupJids(newSelected);
  };

  const toggleAll = () => {
    if (recipientTab === 'contacts') {
      if (selectedContactIds.size === filteredContacts.length && filteredContacts.length > 0) {
        const newSelected = new Set(selectedContactIds);
        filteredContacts.forEach(c => newSelected.delete(c.id));
        setSelectedContactIds(newSelected);
      } else {
        const newSelected = new Set(selectedContactIds);
        filteredContacts.forEach(c => newSelected.add(c.id));
        setSelectedContactIds(newSelected);
      }
    } else {
      if (selectedGroupJids.size === filteredWhatsAppGroups.length && filteredWhatsAppGroups.length > 0) {
        setSelectedGroupJids(new Set());
      } else {
        setSelectedGroupJids(new Set(filteredWhatsAppGroups.map(g => g.group_jid)));
      }
    }
  };

  const selectGroupOnly = (groupId: string) => {
    const groupContacts = contacts.filter(c => 
      groupId === 'none' ? !c.group_id : c.group_id === groupId
    );
    setSelectedContactIds(new Set(groupContacts.map(c => c.id)));
    setSelectedGroupFilter(groupId);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.type.split('/')[0];
    const isDocument = file.type === 'application/pdf' || 
                       file.type === 'application/msword' ||
                       file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                       file.type === 'application/vnd.ms-excel' ||
                       file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    if (!['image', 'video', 'audio'].includes(fileType) && !isDocument) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Selecione uma imagem, vídeo, áudio ou documento (PDF, DOC, DOCX, XLS, XLSX)",
        variant: "destructive",
      });
      return;
    }

    setMediaFile(file);
    
    if (isDocument) {
      setMediaType('document');
      setMediaPreview(null);
    } else {
      setMediaType(fileType as 'image' | 'video' | 'audio');
      const reader = new FileReader();
      reader.onload = (e) => setMediaPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getSelectedInstance = (): EvolutionInstance | null => {
    return instances.find(i => i.id === selectedInstanceId) || null;
  };

  const handleSyncGroups = async () => {
    if (!selectedInstanceId) {
      toast({
        title: "Selecione uma conexão",
        description: "Selecione uma conexão WhatsApp primeiro",
        variant: "destructive",
      });
      return;
    }
    await syncGroups(selectedInstanceId);
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

    const selectedInstance = getSelectedInstance();
    if (!selectedInstance) {
      toast({
        title: "Nenhuma conexão selecionada",
        description: "Selecione uma conexão WhatsApp conectada",
        variant: "destructive",
      });
      return;
    }

    if (selectedInstance.status !== 'connected') {
      toast({
        title: "Conexão desconectada",
        description: "A conexão selecionada não está conectada ao WhatsApp",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    await updateCampaign(campaign.id, { status: 'running' });

    const campaignContacts = await getCampaignContacts(campaign.id);
    const pendingContacts = campaignContacts.filter(cc => cc.status === 'pending');
    setSendingProgress({ current: 0, total: pendingContacts.length });

    let processed = 0;
    for (const cc of pendingContacts) {
      try {
        await updateCampaignContactStatus(campaign.id, cc.contact_id, 'sending');

        // Determine if this is a group or contact
        const isGroup = cc.recipient_type === 'group';

        const { data, error: proxyError } = await supabase.functions.invoke('n8n-proxy', {
          body: {
            webhookUrl,
            payload: {
              key: selectedInstance.api_key,
              recipientType: cc.recipient_type,
              groupJid: cc.group_jid,
              remoteJid: isGroup ? cc.group_jid : `${cc.contact?.phone}@s.whatsapp.net`,
              campaignId: campaign.id,
              contactId: cc.contact_id,
              phone: cc.contact?.phone,
              name: isGroup ? (whatsappGroups.find(g => g.group_jid === cc.group_jid)?.name || 'Grupo') : cc.contact?.name,
              message: campaign.message,
              mediaUrl: campaign.media_url,
              mediaType: campaign.media_type,
              timestamp: new Date().toISOString(),
              evolutionApiUrl: selectedInstance.api_url,
              evolutionInstance: selectedInstance.instance_name,
              // Phantom mentions for groups
              mentionsEveryOne: isGroup ? mentionEveryone : false,
            },
          },
        });

        if (proxyError) throw proxyError;
        console.log('Resposta do proxy:', data);

        await updateCampaignContactStatus(campaign.id, cc.contact_id, 'sent');
        processed++;
        setSendingProgress({ current: processed, total: pendingContacts.length });
        
        // Apply anti-ban delay between messages
        const antiBanSettings = getAntiBanSettings();
        const delay = getRandomDelay(antiBanSettings);
        console.log(`Anti-ban delay: ${delay}ms (${antiBanSettings.minDelaySeconds}s - ${antiBanSettings.maxDelaySeconds}s)`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        console.error('Error sending message:', error);
        await updateCampaignContactStatus(
          campaign.id, 
          cc.contact_id, 
          'failed',
          error instanceof Error ? error.message : 'Erro desconhecido'
        );
      }
    }

    await updateCampaign(campaign.id, { status: 'completed', completed_at: new Date().toISOString() });

    setIsSending(false);
    setSendingProgress({ current: 0, total: 0 });
    toast({
      title: "Campanha finalizada",
      description: "Verifique o status dos envios na aba Campanhas",
    });
    onCampaignCreated();
  };

  const totalSelectedRecipients = selectedContactIds.size + selectedGroupJids.size;

  const validateCampaign = useCallback(() => {
    if (!hasAccess()) {
      toast({
        title: "Acesso bloqueado",
        description: "Seu período de teste expirou. Assine para continuar.",
        variant: "destructive",
      });
      return false;
    }

    const limits = getLimits();

    if (!canCreateCampaign()) {
      toast({
        title: "Limite de campanhas atingido",
        description: `Você atingiu o limite de ${limits.maxCampaigns} campanhas do período de teste.`,
        variant: "destructive",
      });
      return false;
    }

    if (!campaignName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe um nome para a campanha",
        variant: "destructive",
      });
      return false;
    }

    if (!message.trim()) {
      toast({
        title: "Mensagem obrigatória",
        description: "Escreva a mensagem que será enviada",
        variant: "destructive",
      });
      return false;
    }

    if (totalSelectedRecipients === 0) {
      toast({
        title: "Selecione destinatários",
        description: "Selecione pelo menos um contato ou grupo para enviar",
        variant: "destructive",
      });
      return false;
    }

    // Check trial contact limit
    if (!isSubscriptionActive() && totalSelectedRecipients > limits.maxContactsPerCampaign) {
      toast({
        title: "Limite de contatos excedido",
        description: `Durante o período de teste, você pode enviar para no máximo ${limits.maxContactsPerCampaign} destinatários por campanha.`,
        variant: "destructive",
      });
      return false;
    }

    if (isScheduled && (!scheduledDate || !scheduledTime)) {
      toast({
        title: "Data e hora obrigatórias",
        description: "Informe a data e hora do agendamento",
        variant: "destructive",
      });
      return false;
    }

    return true;
  }, [hasAccess, canCreateCampaign, getLimits, isSubscriptionActive, campaignName, message, totalSelectedRecipients, isScheduled, scheduledDate, scheduledTime, toast]);

  const handleRequestSend = useCallback(() => {
    if (validateCampaign()) {
      setShowConfirmDialog(true);
    }
  }, [validateCampaign]);

  const handleConfirmedSend = useCallback(async () => {
    setShowConfirmDialog(false);
    setIsSending(true);

    // Upload media if new file exists, otherwise use preview URL (from template)
    let mediaUrl: string | undefined;
    if (mediaFile) {
      setUploadingMedia(true);
      const { url, error } = await uploadCampaignMedia(mediaFile);
      setUploadingMedia(false);
      if (error || !url) {
        toast({
          title: "Erro no upload",
          description: "Não foi possível enviar a mídia",
          variant: "destructive",
        });
        setIsSending(false);
        return;
      }
      mediaUrl = url;
    } else if (mediaPreview && mediaType) {
      // Use template media URL directly
      mediaUrl = mediaPreview;
    }

    const scheduledAt = isScheduled ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString() : undefined;

    // Combine contacts and groups for campaign creation
    // For groups, we'll use a special format
    const { campaign, error } = await createCampaign(
      campaignName,
      message,
      Array.from(selectedContactIds),
      {
        scheduled_at: scheduledAt,
        media_url: mediaUrl,
        media_type: mediaType || undefined,
        groupJids: Array.from(selectedGroupJids),
      }
    );

    if (error || !campaign) {
      toast({
        title: "Erro ao criar campanha",
        description: error?.message || "Tente novamente",
        variant: "destructive",
      });
      setIsSending(false);
      return;
    }

    toast({
      title: isScheduled ? "Campanha agendada" : "Campanha criada",
      description: isScheduled 
        ? `Campanha "${campaignName}" agendada para ${scheduledDate} às ${scheduledTime}`
        : `Campanha "${campaignName}" criada com ${totalSelectedRecipients} destinatários`,
    });

    // Only start sending if not scheduled
    if (!isScheduled) {
      await sendViaWebhook(campaign as Campaign);
    } else {
      setIsSending(false);
      onCampaignCreated();
    }

    // Reset form
    setCampaignName('');
    setMessage('');
    setSelectedContactIds(new Set());
    setSelectedGroupJids(new Set());
    setIsScheduled(false);
    setScheduledDate('');
    setScheduledTime('');
    clearMedia();
  }, [campaignName, message, selectedContactIds, selectedGroupJids, webhookUrl, toast, onCampaignCreated, isScheduled, scheduledDate, scheduledTime, mediaFile, mediaType, createCampaign, uploadCampaignMedia, updateCampaign, getCampaignContacts, updateCampaignContactStatus, totalSelectedRecipients]);

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

      {/* Progress Bar during sending */}
      {isSending && sendingProgress.total > 0 && (
        <div className="rounded-xl border bg-card p-6 shadow-sm animate-fade-in">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="font-medium">Enviando mensagens...</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {sendingProgress.current} de {sendingProgress.total}
              </span>
            </div>
            <Progress 
              value={(sendingProgress.current / sendingProgress.total) * 100} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground">
              {Math.round((sendingProgress.current / sendingProgress.total) * 100)}% concluído
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Form */}
        <div className="space-y-6">
          {/* Instance Selection */}
          {instances.length > 0 && (
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="space-y-2">
                <Label htmlFor="instance-select" className="flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  Conexão WhatsApp
                </Label>
                <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                  <SelectTrigger id="instance-select">
                    <SelectValue placeholder="Selecione uma conexão" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((instance) => (
                      <SelectItem key={instance.id} value={instance.id}>
                        <div className="flex items-center gap-2">
                          {instance.name}
                          {instance.status === 'connected' ? (
                            <span className="text-xs text-success">✓ Conectado</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">(desconectado)</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {connectedInstances.length === 0 && (
                  <p className="text-xs text-warning">Nenhuma conexão ativa. Conecte um WhatsApp nas configurações.</p>
                )}
              </div>
            </div>
          )}

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

              {/* Template Selection */}
              {templates.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="template-select">Usar Template</Label>
                  <Select
                    value={selectedTemplateId}
                    onValueChange={(value) => {
                      setSelectedTemplateId(value);
                      if (value !== 'none') {
                        const template = templates.find(t => t.id === value);
                        if (template) {
                          setMessage(template.content);
                          // Apply template media
                          if (template.media_url && template.media_type) {
                            setMediaPreview(template.media_url);
                            setMediaType(template.media_type);
                            setMediaFile(null); // Clear file since we're using URL
                          } else {
                            clearMedia();
                          }
                        }
                      } else {
                        clearMedia();
                      }
                    }}
                  >
                    <SelectTrigger id="template-select">
                      <FileText className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Selecione um template (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Escrever do zero</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center gap-2">
                            {template.name}
                            {template.category && (
                              <span className="text-xs text-muted-foreground">({template.category})</span>
                            )}
                            {template.media_type && (
                              <span className="text-xs text-muted-foreground">📎</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="message">Mensagem</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setSelectedTemplateId('none');
                  }}
                  placeholder="Digite sua mensagem aqui...&#10;&#10;Use {nome} para personalizar com o nome do contato"
                  className="min-h-[150px]"
                />
                <p className="text-xs text-muted-foreground">
                  Variáveis disponíveis: {'{nome}'} - nome do contato
                </p>
              </div>
            </div>
          </div>

          {/* Media Upload */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Anexar Mídia (opcional)</Label>
                {mediaFile && (
                  <Button variant="ghost" size="sm" onClick={clearMedia}>
                    <X className="mr-1 h-4 w-4" />
                    Remover
                  </Button>
                )}
              </div>
              
                {!mediaFile ? (
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Selecionar arquivo
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border bg-accent/30 p-4">
                  <div className="flex items-center gap-3">
                    {mediaType === 'image' && <Image className="h-8 w-8 text-primary" />}
                    {mediaType === 'video' && <Video className="h-8 w-8 text-primary" />}
                    {mediaType === 'audio' && <Music className="h-8 w-8 text-primary" />}
                    {mediaType === 'document' && <FileText className="h-8 w-8 text-primary" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{mediaFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(mediaFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  {mediaPreview && mediaType === 'image' && (
                    <img src={mediaPreview} alt="Preview" className="mt-3 max-h-32 rounded-lg object-cover" />
                  )}
                  {mediaPreview && mediaType === 'video' && (
                    <video src={mediaPreview} controls className="mt-3 max-h-32 rounded-lg" />
                  )}
                  {mediaPreview && mediaType === 'audio' && (
                    <audio src={mediaPreview} controls className="mt-3 w-full" />
                  )}
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                Formatos suportados: imagens, vídeos, áudios e documentos (PDF, DOC, DOCX, XLS, XLSX)
              </p>
            </div>
          </div>

          {/* Phantom Mentions for Groups */}
          {selectedGroupJids.size > 0 && (
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="mention-toggle" className="flex items-center gap-2">
                      <Users2 className="h-4 w-4 text-primary" />
                      Menção Fantasma
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Todos os membros receberão notificação como se fossem mencionados, sem aparecer "@" no texto
                    </p>
                  </div>
                  <Switch
                    id="mention-toggle"
                    checked={mentionEveryone}
                    onCheckedChange={setMentionEveryone}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Scheduling */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="schedule-toggle">Agendar envio</Label>
                  <p className="text-xs text-muted-foreground">Enviar em uma data e hora específica</p>
                </div>
                <Switch
                  id="schedule-toggle"
                  checked={isScheduled}
                  onCheckedChange={setIsScheduled}
                />
              </div>
              
              {isScheduled && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="scheduled-date">Data</Label>
                    <Input
                      id="scheduled-date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduled-time">Hora</Label>
                    <Input
                      id="scheduled-time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* WhatsApp Preview */}
          {message && (
            <WhatsAppPreview
              message={message}
              mediaUrl={mediaPreview}
              mediaType={mediaType}
              contactName="João"
            />
          )}

          {/* Send Button */}
          <Button
            size="xl"
            className="w-full"
            onClick={handleRequestSend}
            disabled={isSending || uploadingMedia || !webhookUrl}
          >
            {isSending || uploadingMedia ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {uploadingMedia ? 'Enviando mídia...' : 'Enviando...'}
              </>
            ) : isScheduled ? (
              <>
                <Calendar className="mr-2 h-5 w-5" />
                Agendar Campanha ({totalSelectedRecipients} destinatários)
              </>
            ) : (
              <>
                <Send className="mr-2 h-5 w-5" />
                Criar e Enviar Campanha ({totalSelectedRecipients} destinatários)
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

        {/* Right: Contact/Group Selection */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="border-b p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="font-medium text-foreground">Selecionar Destinatários</h3>
              </div>
              <span className="text-sm text-muted-foreground">
                {totalSelectedRecipients} selecionados
              </span>
            </div>
            
            <Tabs value={recipientTab} onValueChange={setRecipientTab} className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="contacts" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Contatos ({contacts.length})
                </TabsTrigger>
                <TabsTrigger value="groups" className="flex items-center gap-2">
                  <Users2 className="h-4 w-4" />
                  Grupos ({whatsappGroups.length})
                </TabsTrigger>
              </TabsList>

              <div className="mt-4 flex flex-col gap-3">
                <div className="flex gap-2">
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={recipientTab === 'contacts' ? "Buscar contatos..." : "Buscar grupos..."}
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={toggleAll}>
                    {recipientTab === 'contacts' 
                      ? (filteredSelectedCount === filteredContacts.length && filteredContacts.length > 0 ? 'Desmarcar' : 'Selecionar')
                      : (selectedGroupJids.size === filteredWhatsAppGroups.length && filteredWhatsAppGroups.length > 0 ? 'Desmarcar' : 'Selecionar')
                    } Todos
                  </Button>
                </div>
                
                {recipientTab === 'contacts' && (
                  <>
                    {/* Category Filter */}
                    <div className="flex gap-2 items-center">
                      <Select value={selectedGroupFilter} onValueChange={setSelectedGroupFilter}>
                        <SelectTrigger className="flex-1">
                          <Tag className="mr-2 h-4 w-4" />
                          <SelectValue placeholder="Filtrar por categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as categorias</SelectItem>
                          <SelectItem value="none">Sem categoria</SelectItem>
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
                          Selecionar Categoria
                        </Button>
                      )}
                    </div>

                    {/* Quick Category Selection */}
                    {groups.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {groups.map((group) => {
                          const groupCount = contacts.filter(c => c.group_id === group.id).length;
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
                  </>
                )}

                {recipientTab === 'groups' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncGroups}
                    disabled={syncing || !selectedInstanceId}
                  >
                    {syncing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sincronizar Grupos do WhatsApp
                  </Button>
                )}
              </div>

              <TabsContent value="contacts" className="mt-0">
                <div className="max-h-[400px] overflow-y-auto">
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
                        Nenhum contato nesta categoria
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredContacts.map((contact) => {
                        const group = getGroupById(contact.group_id);
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
              </TabsContent>

              <TabsContent value="groups" className="mt-0">
                <div className="max-h-[400px] overflow-y-auto">
                  {whatsappGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Users2 className="h-12 w-12 text-muted-foreground/30" />
                      <p className="mt-4 text-muted-foreground">
                        Nenhum grupo disponível
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Clique em "Sincronizar Grupos" para buscar seus grupos
                      </p>
                    </div>
                  ) : filteredWhatsAppGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Users2 className="h-12 w-12 text-muted-foreground/30" />
                      <p className="mt-4 text-muted-foreground">
                        Nenhum grupo encontrado
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredWhatsAppGroups.map((group) => (
                        <label
                          key={group.group_jid}
                          className="flex cursor-pointer items-center gap-4 p-4 transition-colors hover:bg-accent/50"
                        >
                          <Checkbox
                            checked={selectedGroupJids.has(group.group_jid)}
                            onCheckedChange={() => toggleWhatsAppGroup(group.group_jid)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{group.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {group.participants_count} participantes
                            </p>
                          </div>
                          {selectedGroupJids.has(group.group_jid) && (
                            <Check className="h-5 w-5 text-primary flex-shrink-0" />
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <SendConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={handleConfirmedSend}
        recipientCount={totalSelectedRecipients}
        isScheduled={isScheduled}
      />
    </div>
  );
}
