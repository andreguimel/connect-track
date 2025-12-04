import { useState, useMemo, useCallback } from 'react';
import { Upload, Search, Trash2, Users, Plus, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Contact } from '@/types/contact';
import { getContacts, addContacts, deleteContact, saveContacts } from '@/lib/storage';
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
import { Label } from '@/components/ui/label';

export function ContactsManager() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>(getContacts());
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '' });

  const filteredContacts = useMemo(() => {
    if (!searchTerm) return contacts;
    const term = searchTerm.toLowerCase();
    return contacts.filter(
      c => c.name.toLowerCase().includes(term) || c.phone.includes(term)
    );
  }, [contacts, searchTerm]);

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
          
          if (name && phone && phone.length >= 10) {
            newContacts.push({ name, phone, email });
          }
        }
      }
      
      if (newContacts.length > 0) {
        const result = addContacts(newContacts);
        setContacts(getContacts());
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
  }, [toast]);

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
      email: newContact.email || undefined 
    }]);

    if (result.added > 0) {
      setContacts(getContacts());
      setNewContact({ name: '', phone: '', email: '' });
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

  const handleDelete = (id: string) => {
    deleteContact(id);
    setContacts(getContacts());
    toast({
      title: "Contato removido",
      description: "O contato foi removido com sucesso",
    });
  };

  const handleExportCSV = () => {
    const headers = ['Nome', 'Telefone', 'Email', 'Data de Cadastro'];
    const rows = contacts.map(c => [
      c.name,
      c.phone,
      c.email || '',
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
        
        <div className="flex gap-3">
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

      {/* Search and Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar contatos..."
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{filteredContacts.length} de {contacts.length} contatos</span>
        </div>
      </div>

      {/* CSV Format Hint */}
      <div className="rounded-lg border border-border bg-accent/30 p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Formato do CSV:</strong> Nome, Telefone, Email (opcional). 
          Exemplo: <code className="rounded bg-secondary px-1.5 py-0.5">João Silva, 5511999999999, joao@email.com</code>
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
                <TableHead>Data de Cadastro</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell className="font-mono text-sm">{contact.phone}</TableCell>
                  <TableCell className="text-muted-foreground">{contact.email || '-'}</TableCell>
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
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
