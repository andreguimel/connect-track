import { useState, useMemo } from 'react';
import { FileText, Plus, Search, Trash2, Edit2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MessageTemplate } from '@/types/contact';
import { getTemplates, addTemplate, updateTemplate, deleteTemplate } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
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
  const [templates, setTemplates] = useState<MessageTemplate[]>(getTemplates());
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [formData, setFormData] = useState({ name: '', content: '', category: '' });

  const refreshTemplates = () => {
    setTemplates(getTemplates());
  };

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
      setFormData({ 
        name: template.name, 
        content: template.content, 
        category: template.category || '' 
      });
    } else {
      setEditingTemplate(null);
      setFormData({ name: '', content: '', category: '' });
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome do template é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!formData.content.trim()) {
      toast({
        title: "Erro",
        description: "Conteúdo do template é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (editingTemplate) {
      updateTemplate(editingTemplate.id, formData.name, formData.content, formData.category || undefined);
      toast({
        title: "Sucesso",
        description: "Template atualizado com sucesso",
      });
    } else {
      addTemplate(formData.name, formData.content, formData.category || undefined);
      toast({
        title: "Sucesso",
        description: "Template criado com sucesso",
      });
    }

    refreshTemplates();
    setIsDialogOpen(false);
    setEditingTemplate(null);
    setFormData({ name: '', content: '', category: '' });
  };

  const handleDelete = (id: string) => {
    deleteTemplate(id);
    refreshTemplates();
    toast({
      title: "Template removido",
      description: "O template foi removido com sucesso",
    });
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copiado",
      description: "Conteúdo copiado para a área de transferência",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Templates</h1>
          <p className="mt-1 text-muted-foreground">
            Crie e gerencie templates de mensagens para reutilizar em campanhas
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingTemplate(null);
            setFormData({ name: '', content: '', category: '' });
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'Editar Template' : 'Novo Template'}</DialogTitle>
              <DialogDescription>
                {editingTemplate ? 'Edite os dados do template' : 'Crie um novo template de mensagem'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Nome do Template</Label>
                  <Input
                    id="template-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Promoção de Natal"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-category">Categoria</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger id="template-category">
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-content">Conteúdo da Mensagem</Label>
                <Textarea
                  id="template-content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Digite a mensagem do template...&#10;&#10;Use {nome} para personalizar com o nome do contato"
                  className="min-h-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  Variáveis disponíveis: {'{nome}'} - nome do contato
                </p>
              </div>

              {/* Preview */}
              {formData.content && (
                <div className="rounded-lg border bg-accent/30 p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Prévia:</p>
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {formData.content.replace('{nome}', 'João')}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingTemplate ? 'Salvar Alterações' : 'Criar Template'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar templates..."
            className="pl-10"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="h-16 w-16 text-muted-foreground/30" />
            <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
              Nenhum template ainda
            </h3>
            <p className="mt-2 text-center text-muted-foreground">
              Crie templates para agilizar a criação de campanhas
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <div 
              key={template.id} 
              className="group rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">{template.name}</h3>
                  {template.category && (
                    <span className="inline-block mt-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {template.category}
                    </span>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => handleCopy(template.content)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => handleOpenDialog(template)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <p className="mt-3 text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                {template.content}
              </p>
              
              <p className="mt-3 text-xs text-muted-foreground">
                Atualizado em {template.updatedAt.toLocaleDateString('pt-BR')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}