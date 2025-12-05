import { useState, useMemo, useRef } from 'react';
import { FileText, Plus, Search, Trash2, Edit2, Copy, Upload, X, Image, Video, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useTemplates, MessageTemplate } from '@/hooks/useData';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TEMPLATE_CATEGORIES = [
  'Promoção',
  'Boas-vindas',
  'Lembrete',
  'Informativo',
  'Cobrança',
  'Agradecimento',
  'Outro',
];

export function TemplatesManager() {
  const { toast } = useToast();
  const { templates, loading, addTemplate, updateTemplate, deleteTemplate, uploadTemplateMedia } = useTemplates();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [formData, setFormData] = useState({ name: '', content: '', category: '' });
  const [isSaving, setIsSaving] = useState(false);
  
  // Media state
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | null>(null);
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [existingMediaType, setExistingMediaType] = useState<'image' | 'video' | 'audio' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredTemplates = useMemo(() => {
    if (!searchTerm) return templates;
    const term = searchTerm.toLowerCase();
    return templates.filter(
      t => t.name.toLowerCase().includes(term) || 
           t.content.toLowerCase().includes(term) ||
           t.category?.toLowerCase().includes(term)
    );
  }, [templates, searchTerm]);

  const handleOpenDialog = (template?: MessageTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({ name: template.name, content: template.content, category: template.category || '' });
      setExistingMediaUrl(template.media_url || null);
      setExistingMediaType(template.media_type || null);
    } else {
      setEditingTemplate(null);
      setFormData({ name: '', content: '', category: '' });
      setExistingMediaUrl(null);
      setExistingMediaType(null);
    }
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    setIsDialogOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.type.split('/')[0];
    if (!['image', 'video', 'audio'].includes(fileType)) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Selecione uma imagem, vídeo ou áudio",
        variant: "destructive",
      });
      return;
    }

    setMediaFile(file);
    setMediaType(fileType as 'image' | 'video' | 'audio');
    setExistingMediaUrl(null);
    setExistingMediaType(null);
    
    const reader = new FileReader();
    reader.onload = (e) => setMediaPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    setExistingMediaUrl(null);
    setExistingMediaType(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Erro", description: "Nome do template é obrigatório", variant: "destructive" });
      return;
    }

    if (!formData.content.trim()) {
      toast({ title: "Erro", description: "Conteúdo do template é obrigatório", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    // Upload media if new file selected
    let mediaUrl: string | null = existingMediaUrl;
    let finalMediaType: 'image' | 'video' | 'audio' | null = existingMediaType;

    if (mediaFile) {
      const { url, error } = await uploadTemplateMedia(mediaFile);
      if (error || !url) {
        toast({ title: "Erro no upload", description: "Não foi possível enviar a mídia", variant: "destructive" });
        setIsSaving(false);
        return;
      }
      mediaUrl = url;
      finalMediaType = mediaType;
    }

    if (editingTemplate) {
      await updateTemplate(
        editingTemplate.id, 
        formData.name, 
        formData.content, 
        formData.category || undefined,
        { media_url: mediaUrl, media_type: finalMediaType }
      );
      toast({ title: "Sucesso", description: "Template atualizado com sucesso" });
    } else {
      await addTemplate(
        formData.name, 
        formData.content, 
        formData.category || undefined,
        mediaUrl && finalMediaType ? { media_url: mediaUrl, media_type: finalMediaType } : undefined
      );
      toast({ title: "Sucesso", description: "Template criado com sucesso" });
    }

    setIsSaving(false);
    setIsDialogOpen(false);
    setEditingTemplate(null);
    setFormData({ name: '', content: '', category: '' });
    clearMedia();
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate(id);
    toast({ title: "Template removido", description: "O template foi removido com sucesso" });
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copiado", description: "Conteúdo copiado para a área de transferência" });
  };

  const mediaIcons = {
    image: Image,
    video: Video,
    audio: Music,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Templates</h1>
          <p className="mt-1 text-muted-foreground">Crie e gerencie templates de mensagens para reutilizar em campanhas</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) { 
            setEditingTemplate(null); 
            setFormData({ name: '', content: '', category: '' }); 
            clearMedia();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" />Novo Template</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'Editar Template' : 'Novo Template'}</DialogTitle>
              <DialogDescription>{editingTemplate ? 'Edite os dados do template' : 'Crie um novo template de mensagem'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Nome do Template</Label>
                  <Input id="template-name" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="Ex: Promoção de Natal" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-category">Categoria</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger id="template-category"><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                    <SelectContent>{TEMPLATE_CATEGORIES.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="template-content">Conteúdo da Mensagem</Label>
                <Textarea id="template-content" value={formData.content} onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))} placeholder="Digite a mensagem do template...&#10;&#10;Use {nome} para personalizar com o nome do contato" className="min-h-[150px]" />
                <p className="text-xs text-muted-foreground">Variáveis disponíveis: {'{nome}'} - nome do contato</p>
              </div>

              {/* Media Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Mídia Anexada (opcional)</Label>
                  {(mediaFile || existingMediaUrl) && (
                    <Button variant="ghost" size="sm" onClick={clearMedia}>
                      <X className="mr-1 h-4 w-4" />
                      Remover
                    </Button>
                  )}
                </div>
                
                {!mediaFile && !existingMediaUrl ? (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*,audio/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Selecionar arquivo
                    </Button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Formatos suportados: imagens, vídeos e áudios
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border bg-accent/30 p-4">
                    {mediaFile ? (
                      <div className="flex items-center gap-3">
                        {mediaType === 'image' && <Image className="h-8 w-8 text-primary" />}
                        {mediaType === 'video' && <Video className="h-8 w-8 text-primary" />}
                        {mediaType === 'audio' && <Music className="h-8 w-8 text-primary" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{mediaFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(mediaFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                    ) : existingMediaUrl && existingMediaType && (
                      <div className="flex items-center gap-3">
                        {existingMediaType === 'image' && <Image className="h-8 w-8 text-primary" />}
                        {existingMediaType === 'video' && <Video className="h-8 w-8 text-primary" />}
                        {existingMediaType === 'audio' && <Music className="h-8 w-8 text-primary" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">Mídia existente</p>
                          <p className="text-sm text-muted-foreground capitalize">{existingMediaType}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Preview */}
                    {mediaPreview && mediaType === 'image' && (
                      <img src={mediaPreview} alt="Preview" className="mt-3 max-h-32 rounded-lg object-cover" />
                    )}
                    {mediaPreview && mediaType === 'video' && (
                      <video src={mediaPreview} controls className="mt-3 max-h-32 rounded-lg" />
                    )}
                    {mediaPreview && mediaType === 'audio' && (
                      <audio src={mediaPreview} controls className="mt-3 w-full" />
                    )}
                    {existingMediaUrl && !mediaPreview && existingMediaType === 'image' && (
                      <img src={existingMediaUrl} alt="Preview" className="mt-3 max-h-32 rounded-lg object-cover" />
                    )}
                    {existingMediaUrl && !mediaPreview && existingMediaType === 'video' && (
                      <video src={existingMediaUrl} controls className="mt-3 max-h-32 rounded-lg" />
                    )}
                    {existingMediaUrl && !mediaPreview && existingMediaType === 'audio' && (
                      <audio src={existingMediaUrl} controls className="mt-3 w-full" />
                    )}
                  </div>
                )}
              </div>

              {/* Preview */}
              {formData.content && (
                <div className="rounded-lg border bg-accent/30 p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Prévia:</p>
                  {(mediaPreview || existingMediaUrl) && (mediaType === 'image' || existingMediaType === 'image') && (
                    <img src={mediaPreview || existingMediaUrl!} alt="Preview" className="mb-2 max-h-24 rounded-lg object-cover" />
                  )}
                  <p className="whitespace-pre-wrap text-sm text-foreground">{formData.content.replace('{nome}', 'João')}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Salvando...' : editingTemplate ? 'Salvar Alterações' : 'Criar Template'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar templates..." className="pl-10" />
        </div>
        <span className="text-sm text-muted-foreground">{filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="h-16 w-16 text-muted-foreground/30" />
            <h3 className="mt-4 font-display text-lg font-semibold text-foreground">Nenhum template ainda</h3>
            <p className="mt-2 text-center text-muted-foreground">Crie templates para agilizar a criação de campanhas</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => {
            const MediaIcon = template.media_type ? mediaIcons[template.media_type] : null;
            return (
              <div key={template.id} className="group rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-foreground truncate">{template.name}</h3>
                      {MediaIcon && (
                        <Badge variant="outline" className="gap-1">
                          <MediaIcon className="h-3 w-3" />
                        </Badge>
                      )}
                    </div>
                    {template.category && (<span className="inline-block mt-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{template.category}</span>)}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(template.content)}><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(template)}><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(template.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {template.media_url && template.media_type === 'image' && (
                  <img src={template.media_url} alt="Mídia" className="mt-3 h-20 w-full rounded-lg object-cover" />
                )}
                <p className="mt-3 text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">{template.content}</p>
                <p className="mt-3 text-xs text-muted-foreground">Atualizado em {new Date(template.updated_at).toLocaleDateString('pt-BR')}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}