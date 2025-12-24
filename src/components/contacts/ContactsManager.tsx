import { useState, useMemo, useCallback } from 'react';
import { Upload, Search, Trash2, Users, Plus, Download, FolderPlus, Tag, Edit2, ChevronLeft, ChevronRight, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useContacts, useGroups, Contact, ContactGroup } from '@/hooks/useData';
import { useToast } from '@/hooks/use-toast';
import { ImportWhatsAppContacts } from './ImportWhatsAppContacts';
import { ImportChatwootContacts } from './ImportChatwootContacts';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';

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
  const { contacts, loading, fetchContacts, addContacts, updateContact, deleteContact: removeContact } = useContacts();
  const { groups, fetchGroups, addGroup, updateGroup: editGroup, deleteGroup: removeGroup } = useGroups();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ContactGroup | null>(null);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', group_id: '' });
  const [newGroup, setNewGroup] = useState({ name: '', color: 'bg-blue-500' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

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

  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredContacts.slice(start, start + itemsPerPage);
  }, [filteredContacts, currentPage, itemsPerPage]);

  // Reset page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedGroupFilter, itemsPerPage]);

  const getGroupById = (groupId: string | undefined) => {
    if (!groupId) return null;
    return groups.find(g => g.id === groupId);
  };

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      const startIndex = lines[0].toLowerCase().includes('nome') || 
                         lines[0].toLowerCase().includes('name') ||
                         lines[0].toLowerCase().includes('telefone') ||
                         lines[0].toLowerCase().includes('phone') ? 1 : 0;
      
      const newContacts: Omit<Contact, 'id' | 'created_at'>[] = [];
      
      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(/[,;]/).map(p => p.trim().replace(/"/g, ''));
        if (parts.length >= 2) {
          const name = parts[0];
          const phone = parts[1].replace(/\D/g, '');
          const email = parts[2] || undefined;
          const groupName = parts[3]?.trim();
          
          let group_id: string | undefined;
          if (groupName) {
            const existingGroup = groups.find(g => g.name.toLowerCase() === groupName.toLowerCase());
            if (existingGroup) {
              group_id = existingGroup.id;
            } else {
              const { data } = await addGroup(groupName, GROUP_COLORS[groups.length % GROUP_COLORS.length].value);
              group_id = data?.id;
            }
          }
          
          if (name && phone && phone.length >= 10) {
            newContacts.push({ name, phone, email, group_id });
          }
        }
      }
      
      if (newContacts.length > 0) {
        const result = await addContacts(newContacts);
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
  }, [toast, groups, addContacts, addGroup]);

  const handleAddContact = async () => {
    if (!newContact.name || !newContact.phone) {
      toast({ title: "Erro", description: "Nome e telefone são obrigatórios", variant: "destructive" });
      return;
    }

    const phone = newContact.phone.replace(/\D/g, '');
    if (phone.length < 10) {
      toast({ title: "Erro", description: "Telefone inválido", variant: "destructive" });
      return;
    }

    const result = await addContacts([{ 
      name: newContact.name, 
      phone,
      email: newContact.email || undefined,
      group_id: newContact.group_id || undefined,
    }]);

    if (result.added > 0) {
      setNewContact({ name: '', phone: '', email: '', group_id: '' });
      setIsAddDialogOpen(false);
      toast({ title: "Sucesso", description: "Contato adicionado com sucesso" });
    } else {
      toast({ title: "Erro", description: "Este telefone já está cadastrado", variant: "destructive" });
    }
  };

  const handleAddGroup = async () => {
    if (!newGroup.name.trim()) {
      toast({ title: "Erro", description: "Nome do ticket é obrigatório", variant: "destructive" });
      return;
    }

    if (editingGroup) {
      await editGroup(editingGroup.id, newGroup.name, newGroup.color);
      toast({ title: "Sucesso", description: "Ticket atualizado com sucesso" });
    } else {
      await addGroup(newGroup.name, newGroup.color);
      toast({ title: "Sucesso", description: "Ticket criado com sucesso" });
    }

    setNewGroup({ name: '', color: 'bg-blue-500' });
    setEditingGroup(null);
    setIsGroupDialogOpen(false);
  };

  const handleEditGroup = (group: ContactGroup) => {
    setEditingGroup(group);
    setNewGroup({ name: group.name, color: group.color });
    setIsGroupDialogOpen(true);
  };

  const handleDeleteGroup = async (id: string) => {
    await removeGroup(id);
    toast({ title: "Ticket removido", description: "O ticket foi removido e os contatos foram desvinculados" });
  };

  const handleChangeContactGroup = async (contactId: string, groupId: string) => {
    await updateContact(contactId, { group_id: groupId === 'none' ? undefined : groupId });
  };

  const handleDelete = async (id: string) => {
    await removeContact(id);
    setSelectedContacts(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast({ title: "Contato removido", description: "O contato foi removido com sucesso" });
  };

  const handleBulkDelete = async () => {
    const count = selectedContacts.size;
    for (const id of selectedContacts) {
      await removeContact(id);
    }
    setSelectedContacts(new Set());
    toast({ title: "Contatos removidos", description: `${count} contatos foram removidos com sucesso` });
  };

  const toggleSelectAll = () => {
    if (selectedContacts.size === paginatedContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(paginatedContacts.map(c => c.id)));
    }
  };

  const toggleSelectContact = (id: string) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExportCSV = (exportGroupId?: string) => {
    let contactsToExport = contacts;
    let fileName = 'contatos';
    
    if (exportGroupId && exportGroupId !== 'all') {
      if (exportGroupId === 'none') {
        contactsToExport = contacts.filter(c => !c.group_id);
        fileName = 'contatos_sem_ticket';
      } else {
        contactsToExport = contacts.filter(c => c.group_id === exportGroupId);
        const groupName = getGroupById(exportGroupId)?.name || 'ticket';
        fileName = `contatos_${groupName.replace(/\s+/g, '_').toLowerCase()}`;
      }
    }
    
    const headers = ['Nome', 'Telefone', 'Email', 'Ticket', 'Data de Cadastro'];
    const rows = contactsToExport.map(c => [
      c.name,
      c.phone,
      c.email || '',
      getGroupById(c.group_id)?.name || '',
      new Date(c.created_at).toLocaleDateString('pt-BR')
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Contatos</h1>
          <p className="mt-1 text-sm md:text-base text-muted-foreground">Gerencie sua lista de contatos para envio</p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={contacts.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Exportar Contatos</DialogTitle>
                <DialogDescription>Escolha quais contatos deseja exportar</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Button variant="outline" className="w-full justify-start" onClick={() => handleExportCSV('all')}>
                  <Users className="mr-2 h-4 w-4" />
                  Todos os contatos ({contacts.length})
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => handleExportCSV('none')}>
                  <Tag className="mr-2 h-4 w-4 text-muted-foreground" />
                  Sem ticket ({contacts.filter(c => !c.group_id).length})
                </Button>
                {groups.length > 0 && (
                  <div className="border-t pt-4">
                    <Label className="mb-2 block text-sm text-muted-foreground">Por Ticket</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {groups.map((group) => {
                        const count = contacts.filter(c => c.group_id === group.id).length;
                        return (
                          <Button
                            key={group.id}
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => handleExportCSV(group.id)}
                          >
                            <div className={`h-3 w-3 rounded-full ${group.color} mr-2`} />
                            {group.name} ({count})
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          
          <label htmlFor="csv-upload">
            <Button variant="outline" size="sm" asChild>
              <span className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Importar CSV</span>
                <span className="sm:hidden">CSV</span>
              </span>
            </Button>
          </label>
          <input id="csv-upload" type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />

          <ImportWhatsAppContacts onImportComplete={fetchContacts} />
          <ImportChatwootContacts onImportComplete={fetchContacts} />

          <Dialog open={isGroupDialogOpen} onOpenChange={(open) => {
            setIsGroupDialogOpen(open);
            if (!open) { setEditingGroup(null); setNewGroup({ name: '', color: 'bg-blue-500' }); }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Ticket className="mr-2 h-4 w-4" /><span className="hidden sm:inline">Tickets</span></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingGroup ? 'Editar Ticket' : 'Gerenciar Tickets'}</DialogTitle>
                <DialogDescription>{editingGroup ? 'Edite os dados do ticket' : 'Crie e gerencie tickets para organizar seus contatos'}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="group-name">Nome do Ticket</Label>
                  <Input id="group-name" value={newGroup.name} onChange={(e) => setNewGroup(prev => ({ ...prev, name: e.target.value }))} placeholder="Ex: Clientes VIP" />
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex flex-wrap gap-2">
                    {GROUP_COLORS.map((color) => (
                      <button key={color.value} type="button" onClick={() => setNewGroup(prev => ({ ...prev, color: color.value }))} className={`h-8 w-8 rounded-full ${color.value} ${newGroup.color === color.value ? 'ring-2 ring-offset-2 ring-primary' : ''}`} title={color.name} />
                    ))}
                  </div>
                </div>
                <Button onClick={handleAddGroup} className="w-full">{editingGroup ? 'Salvar Alterações' : 'Criar Ticket'}</Button>
                {!editingGroup && groups.length > 0 && (
                  <div className="border-t pt-4">
                    <Label className="mb-2 block">Tickets Existentes</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {groups.map((group) => (
                        <div key={group.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-2">
                            <div className={`h-4 w-4 rounded-full ${group.color}`} />
                            <span className="font-medium">{group.name}</span>
                            <span className="text-xs text-muted-foreground">({contacts.filter(c => c.group_id === group.id).length} contatos)</span>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditGroup(group)}><Edit2 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteGroup(group.id)}><Trash2 className="h-4 w-4" /></Button>
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
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" /><span className="hidden sm:inline">Adicionar</span></Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Contato</DialogTitle>
                <DialogDescription>Preencha os dados do novo contato</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2"><Label htmlFor="name">Nome</Label><Input id="name" value={newContact.name} onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))} placeholder="Nome do contato" /></div>
                <div className="space-y-2"><Label htmlFor="phone">Telefone</Label><Input id="phone" value={newContact.phone} onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))} placeholder="5511999999999" /></div>
                <div className="space-y-2"><Label htmlFor="email">Email (opcional)</Label><Input id="email" type="email" value={newContact.email} onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))} placeholder="email@exemplo.com" /></div>
                <div className="space-y-2">
                  <Label htmlFor="contact-group">Ticket (opcional)</Label>
                  <Select value={newContact.group_id || 'none'} onValueChange={(value) => setNewContact(prev => ({ ...prev, group_id: value === 'none' ? '' : value }))}>
                    <SelectTrigger id="contact-group"><SelectValue placeholder="Selecione um ticket" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem ticket</SelectItem>
                      {groups.map((group) => (<SelectItem key={group.id} value={group.id}><div className="flex items-center gap-2"><div className={`h-3 w-3 rounded-full ${group.color}`} />{group.name}</div></SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddContact}>Adicionar</Button>
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
            <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar contatos..." className="pl-10" />
          </div>
          <Select value={selectedGroupFilter} onValueChange={setSelectedGroupFilter}>
            <SelectTrigger className="w-48"><Ticket className="mr-2 h-4 w-4" /><SelectValue placeholder="Filtrar por ticket" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tickets</SelectItem>
              <SelectItem value="none">Sem ticket</SelectItem>
              {groups.map((group) => (<SelectItem key={group.id} value={group.id}><div className="flex items-center gap-2"><div className={`h-3 w-3 rounded-full ${group.color}`} />{group.name}</div></SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-4">
          {selectedContacts.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir {selectedContacts.size} selecionados
            </Button>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{filteredContacts.length} de {contacts.length} contatos</span>
          </div>
        </div>
      </div>

      {/* CSV Format Hint */}
      <div className="rounded-lg border border-border bg-accent/30 p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Formato do CSV:</strong> Nome, Telefone, Email, Ticket (opcional). 
          Exemplo: <code className="rounded bg-secondary px-1.5 py-0.5">João Silva, 5511999999999, joao@email.com, Clientes VIP</code>
        </p>
      </div>

      {/* Contacts Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 md:py-16">
            <Users className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground/30" />
            <h3 className="mt-4 font-display text-base md:text-lg font-semibold text-foreground">Nenhum contato ainda</h3>
            <p className="mt-2 text-center text-sm text-muted-foreground px-4">Importe um arquivo CSV ou adicione contatos manualmente</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={paginatedContacts.length > 0 && selectedContacts.size === paginatedContacts.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="min-w-[120px]">Nome</TableHead>
                  <TableHead className="min-w-[120px]">Telefone</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden sm:table-cell min-w-[140px]">Ticket</TableHead>
                  <TableHead className="hidden lg:table-cell">Data</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedContacts.map((contact) => {
                  const group = getGroupById(contact.group_id);
                  return (
                    <TableRow key={contact.id} className={selectedContacts.has(contact.id) ? 'bg-accent/50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedContacts.has(contact.id)}
                          onCheckedChange={() => toggleSelectContact(contact.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sm">{contact.name}</TableCell>
                      <TableCell className="font-mono text-xs md:text-sm">{contact.phone}</TableCell>
                      <TableCell className="text-muted-foreground text-sm hidden md:table-cell">{contact.email || '-'}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Select value={contact.group_id || 'none'} onValueChange={(value) => handleChangeContactGroup(contact.id, value)}>
                          <SelectTrigger className="w-28 md:w-36 h-8 text-xs md:text-sm">
                            <SelectValue>{group ? (<div className="flex items-center gap-2"><div className={`h-2.5 w-2.5 md:h-3 md:w-3 rounded-full ${group.color}`} /><span className="truncate">{group.name}</span></div>) : (<span className="text-muted-foreground">Sem ticket</span>)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem ticket</SelectItem>
                            {groups.map((g) => (<SelectItem key={g.id} value={g.id}><div className="flex items-center gap-2"><div className={`h-3 w-3 rounded-full ${g.color}`} />{g.name}</div></SelectItem>))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm hidden lg:table-cell">{new Date(contact.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(contact.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredContacts.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Exibir</span>
            <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">por página</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredContacts.length)} de {filteredContacts.length}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}