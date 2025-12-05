import { useState, useMemo, useCallback } from 'react';
import { Upload, Search, Trash2, Users, Plus, Download, FolderPlus, Tag, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Contact, ContactGroup } from '@/types/contact';
import { getContacts, addContacts, deleteContact, saveContacts, getGroups, addGroup, updateGroup, deleteGroup, updateContactGroup } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const GROUP_COLORS = [
  { name: 'Azul', value: 'bg-blue-500' },
  { name: 'Verde', value: 'bg-green-500' },
  { name: 'Vermelho', value: 'bg-red-500' },
  { name: 'Amarelo', value: 'bg-yellow-500' },
  { name: 'Roxo', value: 'bg-purple-500' },
  { name: 'Rosa', value: 'bg-pink-500' },
  { name: 'Laranja', value: 'bg-orange-500' },
  { name: 'Ciano', value: 'bg-cyan-500' },
];

export function ContactsManager() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>(getContacts());
  const [groups, setGroups] = useState<ContactGroup[]>(getGroups());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ContactGroup | null>(null);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', groupId: '' });
  const [newGroup, setNewGroup] = useState({ name: '', color: 'bg-blue-500' });

  const refreshData = () => {
    setContacts(getContacts());
    setGroups(getGroups());
  };

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

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      // Skip header if exists
      const startIndex = lines[0].toLowerCase().includes('nome') || 
                         lines[0].toLowerCase().includes('name') ||
                         lines[0].toLowerCase().includes('telefone') ||
                         lines[0].toLowerCase().includes('phone') ? 1 : 0;
      
      const newContacts: Omit<Contact, 'id' | 'createdAt'>[] = [];
      
      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(/[,;]/).map(p => p.trim().replace(/"/g, ''));
        if (parts.length >= 2) {
          const name = parts[0];
          const phone = parts[1].replace(/\D/g, '');
          const email = parts[2] || undefined;
          const groupName = parts[3]?.trim();
          
          // Find or create group by name
          let groupId: string | undefined;
          if (groupName) {
            const existingGroup = groups.find(g => g.name.toLowerCase() === groupName.toLowerCase());
            if (existingGroup) {
              groupId = existingGroup.id;
            } else {
              // Create new group
              const newGroupItem = addGroup(groupName, GROUP_COLORS[groups.length % GROUP_COLORS.length].value);
              groupId = newGroupItem.id;
              setGroups(getGroups());
            }
          }
          
          if (name && phone && phone.length >= 10) {
            newContacts.push({ name, phone, email, groupId });
          }
        }
      }
      
      if (newContacts.length > 0) {
        const result = addContacts(newContacts);
        refreshData();
        toast({
          title: "Importação concluída",
          description: `${result.added} contatos adicionados${result.duplicates > 0 ? `, ${result.duplicates} duplicados ignorados` : ''}`,
        });
      } else {
        toast({
          title: "Erro na importação",
          description: "Nenhum contato válido encontrado no arquivo",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }, [toast, groups]);

  const handleAddContact = () => {
    if (!newContact.name || !newContact.phone) {
      toast({
        title: "Erro",
        description: "Nome e telefone são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const phone = newContact.phone.replace(/\D/g, '');
    if (phone.length < 10) {
      toast({
        title: "Erro",
        description: "Telefone inválido",
        variant: "destructive",
      });
      return;
    }

    const result = addContacts([{ 
      name: newContact.name, 
      phone,
      email: newContact.email || undefined,
      groupId: newContact.groupId || undefined,
    }]);

    if (result.added > 0) {
      refreshData();
      setNewContact({ name: '', phone: '', email: '', groupId: '' });
      setIsAddDialogOpen(false);
      toast({
        title: "Sucesso",
        description: "Contato adicionado com sucesso",
      });
    } else {
      toast({
        title: "Erro",
        description: "Este telefone já está cadastrado",
        variant: "destructive",
      });
    }
  };

  const handleAddGroup = () => {
    if (!newGroup.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome do grupo é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (editingGroup) {
      updateGroup(editingGroup.id, newGroup.name, newGroup.color);
      toast({
        title: "Sucesso",
        description: "Grupo atualizado com sucesso",
      });
    } else {
      addGroup(newGroup.name, newGroup.color);
      toast({
        title: "Sucesso",
        description: "Grupo criado com sucesso",
      });
    }

    refreshData();
    setNewGroup({ name: '', color: 'bg-blue-500' });
    setEditingGroup(null);
    setIsGroupDialogOpen(false);
  };

  const handleEditGroup = (group: ContactGroup) => {
    setEditingGroup(group);
    setNewGroup({ name: group.name, color: group.color });
    setIsGroupDialogOpen(true);
  };

  const handleDeleteGroup = (id: string) => {
    deleteGroup(id);
    refreshData();
    toast({
      title: "Grupo removido",
      description: "O grupo foi removido e os contatos foram desvinculados",
    });
  };

  const handleChangeContactGroup = (contactId: string, groupId: string) => {
    updateContactGroup(contactId, groupId === 'none' ? undefined : groupId);
    refreshData();
  };

  const handleDelete = (id: string) => {
    deleteContact(id);
    refreshData();
    toast({
      title: "Contato removido",
      description: "O contato foi removido com sucesso",
    });
  };

  const handleExportCSV = () => {
    const headers = ['Nome', 'Telefone', 'Email', 'Grupo', 'Data de Cadastro'];
    const rows = contacts.map(c => [
      c.name,
      c.phone,
      c.email || '',
      getGroupById(c.groupId)?.name || '',
      c.createdAt.toLocaleDateString('pt-BR')
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contatos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Contatos</h1>
          <p className="mt-1 text-muted-foreground">
            Gerencie sua lista de contatos para envio
          </p>
        </div>
        
        <div className="flex gap-3 flex-wrap">
          <Button variant="outline" onClick={handleExportCSV} disabled={contacts.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          
          <label htmlFor="csv-upload">
            <Button variant="outline" asChild>
              <span className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" />
                Importar CSV
              </span>
            </Button>
          </label>
          <input
            id="csv-upload"
            type="file"
            accept=".csv,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />

          <Dialog open={isGroupDialogOpen} onOpenChange={(open) => {
            setIsGroupDialogOpen(open);
            if (!open) {
              setEditingGroup(null);
              setNewGroup({ name: '', color: 'bg-blue-500' });
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FolderPlus className="mr-2 h-4 w-4" />
                Grupos
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingGroup ? 'Editar Grupo' : 'Gerenciar Grupos'}</DialogTitle>
                <DialogDescription>
                  {editingGroup ? 'Edite os dados do grupo' : 'Crie e gerencie grupos para organizar seus contatos'}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="group-name">Nome do Grupo</Label>
                  <Input
                    id="group-name"
                    value={newGroup.name}
                    onChange={(e) => setNewGroup(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Clientes VIP"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex flex-wrap gap-2">
                    {GROUP_COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setNewGroup(prev => ({ ...prev, color: color.value }))}
                        className={`h-8 w-8 rounded-full ${color.value} ${newGroup.color === color.value ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                <Button onClick={handleAddGroup} className="w-full">
                  {editingGroup ? 'Salvar Alterações' : 'Criar Grupo'}
                </Button>

                {!editingGroup && groups.length > 0 && (
                  <div className="border-t pt-4">
                    <Label className="mb-2 block">Grupos Existentes</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {groups.map((group) => (
                        <div key={group.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-2">
                            <div className={`h-4 w-4 rounded-full ${group.color}`} />
                            <span className="font-medium">{group.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({contacts.filter(c => c.groupId === group.id).length} contatos)
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditGroup(group)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteGroup(group.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Contato</DialogTitle>
                <DialogDescription>
                  Preencha os dados do novo contato
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={newContact.name}
                    onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome do contato"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={newContact.phone}
                    onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="5511999999999"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newContact.email}
                    onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-group">Grupo (opcional)</Label>
                  <Select
                    value={newContact.groupId || 'none'}
                    onValueChange={(value) => setNewContact(prev => ({ ...prev, groupId: value === 'none' ? '' : value }))}
                  >
                    <SelectTrigger id="contact-group">
                      <SelectValue placeholder="Selecione um grupo" />
                    </SelectTrigger>
                    <SelectContent>
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
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddContact}>
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-4 max-w-2xl">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar contatos..."
              className="pl-10"
            />
          </div>
          <Select value={selectedGroupFilter} onValueChange={setSelectedGroupFilter}>
            <SelectTrigger className="w-48">
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
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{filteredContacts.length} de {contacts.length} contatos</span>
        </div>
      </div>

      {/* CSV Format Hint */}
      <div className="rounded-lg border border-border bg-accent/30 p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Formato do CSV:</strong> Nome, Telefone, Email, Grupo (opcional). 
          Exemplo: <code className="rounded bg-secondary px-1.5 py-0.5">João Silva, 5511999999999, joao@email.com, Clientes VIP</code>
        </p>
      </div>

      {/* Contacts Table */}
      <div className="rounded-xl border bg-card shadow-sm">
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="h-16 w-16 text-muted-foreground/30" />
            <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
              Nenhum contato ainda
            </h3>
            <p className="mt-2 text-center text-muted-foreground">
              Importe um arquivo CSV ou adicione contatos manualmente
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Data de Cadastro</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => {
                const group = getGroupById(contact.groupId);
                return (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell className="font-mono text-sm">{contact.phone}</TableCell>
                    <TableCell className="text-muted-foreground">{contact.email || '-'}</TableCell>
                    <TableCell>
                      <Select
                        value={contact.groupId || 'none'}
                        onValueChange={(value) => handleChangeContactGroup(contact.id, value)}
                      >
                        <SelectTrigger className="w-36 h-8">
                          <SelectValue>
                            {group ? (
                              <div className="flex items-center gap-2">
                                <div className={`h-3 w-3 rounded-full ${group.color}`} />
                                <span className="truncate">{group.name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Sem grupo</span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem grupo</SelectItem>
                          {groups.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              <div className="flex items-center gap-2">
                                <div className={`h-3 w-3 rounded-full ${g.color}`} />
                                {g.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.createdAt.toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(contact.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}