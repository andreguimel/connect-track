import { useState, useMemo } from 'react';
import { MessageSquare, Loader2, UserCheck, UserPlus, Users, Plus, Search, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useContacts, useGroups } from '@/hooks/useData';
import { supabase } from '@/integrations/supabase/client';

const CATEGORY_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-orange-500',
];

interface ChatwootContact {
  id: number;
  name: string;
  phoneNumber: string;
  email: string | null;
  ticket: string | null;
  alreadyExists?: boolean;
}

interface ImportChatwootContactsProps {
  onImportComplete?: () => void;
}

export function ImportChatwootContacts({ onImportComplete }: ImportChatwootContactsProps) {
  const { toast } = useToast();
  const { contacts: existingContacts, addContacts } = useContacts();
  const { groups: categories, addGroup } = useGroups();

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Credentials
  const [apiUrl, setApiUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [accountId, setAccountId] = useState('');

  // Contacts
  const [contacts, setContacts] = useState<ChatwootContact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Category
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [useTicketAsCategory, setUseTicketAsCategory] = useState(true);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);

  // Get existing phones for duplicate check
  const existingPhones = useMemo(() => {
    return new Set(existingContacts.map(c => c.phone));
  }, [existingContacts]);

  const handleFetchContacts = async () => {
    if (!apiUrl || !apiToken || !accountId) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos de conexão',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('chatwoot-contacts', {
        body: { apiUrl, apiToken, accountId },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Erro ao buscar contatos');
      }

      // Mark which contacts already exist
      const contactsWithStatus = (data.contacts || []).map((c: ChatwootContact) => ({
        ...c,
        alreadyExists: existingPhones.has(c.phoneNumber),
      }));

      setContacts(contactsWithStatus);
      setHasFetched(true);

      toast({
        title: 'Sucesso',
        description: `${contactsWithStatus.length} contatos encontrados`,
      });
    } catch (error) {
      console.error('Error fetching Chatwoot contacts:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao buscar contatos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleContact = (phoneNumber: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(phoneNumber)) {
      newSelected.delete(phoneNumber);
    } else {
      newSelected.add(phoneNumber);
    }
    setSelectedContacts(newSelected);
  };

  const selectAllNew = () => {
    const newContacts = contacts.filter(c => !c.alreadyExists);
    if (selectedContacts.size === newContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(newContacts.map(c => c.phoneNumber)));
    }
  };

  const filteredContacts = useMemo(() => {
    if (!searchTerm) return contacts;
    const term = searchTerm.toLowerCase();
    return contacts.filter(
      c => c.name.toLowerCase().includes(term) || c.phoneNumber.includes(term)
    );
  }, [contacts, searchTerm]);

  const handleImport = async () => {
    const contactsToImport = contacts.filter(c => selectedContacts.has(c.phoneNumber) && !c.alreadyExists);
    if (contactsToImport.length === 0) {
      toast({
        title: 'Nenhum contato selecionado',
        description: 'Selecione pelo menos um contato novo para importar',
      });
      return;
    }

    setIsImporting(true);
    try {
      // Group contacts by ticket if using ticket as category
      const ticketGroups: Record<string, string> = {};
      
      if (useTicketAsCategory) {
        // Get unique tickets and create/find groups for them
        const uniqueTickets = [...new Set(contactsToImport.map(c => c.ticket).filter(Boolean))] as string[];
        
        for (const ticket of uniqueTickets) {
          // Check if group already exists
          const existingGroup = categories.find(g => g.name.toLowerCase() === ticket.toLowerCase());
          if (existingGroup) {
            ticketGroups[ticket] = existingGroup.id;
          } else {
            // Create new group
            const color = CATEGORY_COLORS[Object.keys(ticketGroups).length % CATEGORY_COLORS.length];
            const result = await addGroup(ticket, color);
            if (result?.data?.id) {
              ticketGroups[ticket] = result.data.id;
            }
          }
        }
      }

      // Prepare contacts for import
      const newContacts = contactsToImport.map(c => {
        let group_id: string | undefined;
        
        if (useTicketAsCategory && c.ticket) {
          group_id = ticketGroups[c.ticket];
        } else if (selectedGroupId) {
          group_id = selectedGroupId;
        }

        return {
          name: c.name,
          phone: c.phoneNumber,
          email: c.email || undefined,
          group_id,
        };
      });

      const result = await addContacts(newContacts);

      toast({
        title: 'Importação concluída',
        description: `${result.added} contatos adicionados${result.duplicates > 0 ? `, ${result.duplicates} duplicados ignorados` : ''}`,
      });

      setIsOpen(false);
      onImportComplete?.();
    } catch (error) {
      console.error('Error importing contacts:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao importar contatos',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset state
      setHasFetched(false);
      setContacts([]);
      setSelectedContacts(new Set());
      setSearchTerm('');
      setSelectedGroupId('');
      setApiUrl('');
      setApiToken('');
      setAccountId('');
    }
  };

  const newContactsCount = contacts.filter(c => !c.alreadyExists).length;
  const existingContactsCount = contacts.filter(c => c.alreadyExists).length;
  const contactsWithTicket = contacts.filter(c => c.ticket).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquare className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Chatwoot</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Importar Contatos do Chatwoot</DialogTitle>
          <DialogDescription>
            Conecte ao seu Chatwoot para importar contatos com seus tickets
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!hasFetched ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-url">URL da API do Chatwoot</Label>
                <Input
                  id="api-url"
                  placeholder="https://app.chatwoot.com"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-id">Account ID</Label>
                <Input
                  id="account-id"
                  placeholder="1"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Encontre em Settings → Account Settings
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-token">API Access Token</Label>
                <Input
                  id="api-token"
                  type="password"
                  placeholder="Seu token de acesso"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Encontre em Profile Settings → Access Token
                </p>
              </div>
              <Button 
                onClick={handleFetchContacts} 
                disabled={loading || !apiUrl || !apiToken || !accountId}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  'Buscar Contatos'
                )}
              </Button>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm flex-wrap">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {contacts.length} contatos
                  </span>
                  {newContactsCount > 0 && (
                    <span className="flex items-center gap-1 text-green-600">
                      <UserPlus className="h-4 w-4" />
                      {newContactsCount} novos
                    </span>
                  )}
                  {existingContactsCount > 0 && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <UserCheck className="h-4 w-4" />
                      {existingContactsCount} já existem
                    </span>
                  )}
                  {contactsWithTicket > 0 && (
                    <span className="flex items-center gap-1 text-primary">
                      <Tag className="h-4 w-4" />
                      {contactsWithTicket} com ticket
                    </span>
                  )}
                </div>
                {newContactsCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={selectAllNew}>
                    {selectedContacts.size === newContactsCount ? 'Desmarcar todos' : 'Selecionar novos'}
                  </Button>
                )}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar contatos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Contacts List */}
              <ScrollArea className="h-64 rounded-lg border bg-background">
                {filteredContacts.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Nenhum contato encontrado
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredContacts.map((contact) => (
                      <div
                        key={contact.phoneNumber}
                        className={`flex items-center gap-3 rounded-md p-2 hover:bg-accent/50 cursor-pointer ${
                          contact.alreadyExists ? 'opacity-50' : ''
                        }`}
                        onClick={() => !contact.alreadyExists && toggleContact(contact.phoneNumber)}
                      >
                        <Checkbox
                          checked={selectedContacts.has(contact.phoneNumber)}
                          onCheckedChange={() => toggleContact(contact.phoneNumber)}
                          disabled={contact.alreadyExists}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {contact.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{contact.phoneNumber}</p>
                        </div>
                        {contact.ticket && (
                          <Badge variant="secondary" className="shrink-0">
                            {contact.ticket}
                          </Badge>
                        )}
                        {contact.alreadyExists && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
                            Já existe
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Category Selection */}
              {newContactsCount > 0 && (
                <div className="space-y-3">
                  {contactsWithTicket > 0 && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="use-ticket"
                        checked={useTicketAsCategory}
                        onCheckedChange={(checked) => setUseTicketAsCategory(!!checked)}
                      />
                      <Label htmlFor="use-ticket" className="text-sm cursor-pointer">
                        Usar ticket do Chatwoot como categoria
                      </Label>
                    </div>
                  )}

                  {!useTicketAsCategory && (
                    <div className="space-y-2">
                      <Label>Categoria para importar</Label>
                      {isCreatingCategory ? (
                        <div className="space-y-3">
                          <Input
                            placeholder="Nome da nova categoria"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            autoFocus
                          />
                          <div className="flex flex-wrap gap-2">
                            {CATEGORY_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={`h-6 w-6 rounded-full ${color} transition-all ${
                                  newCategoryColor === color 
                                    ? 'ring-2 ring-offset-2 ring-primary' 
                                    : 'hover:scale-110'
                                }`}
                                onClick={() => setNewCategoryColor(color)}
                              />
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={async () => {
                                if (newCategoryName.trim()) {
                                  const result = await addGroup(newCategoryName.trim(), newCategoryColor);
                                  if (result?.data?.id) {
                                    setSelectedGroupId(result.data.id);
                                  }
                                  setNewCategoryName('');
                                  setNewCategoryColor(CATEGORY_COLORS[0]);
                                  setIsCreatingCategory(false);
                                }
                              }}
                              disabled={!newCategoryName.trim()}
                            >
                              Criar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setIsCreatingCategory(false);
                                setNewCategoryName('');
                                setNewCategoryColor(CATEGORY_COLORS[0]);
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Select value={selectedGroupId || "none"} onValueChange={(v) => setSelectedGroupId(v === "none" ? "" : v)}>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Sem categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem categoria</SelectItem>
                              {categories.map((group) => (
                                <SelectItem key={group.id} value={group.id}>
                                  <div className="flex items-center gap-2">
                                    <div className={`h-3 w-3 rounded-full ${group.color}`} />
                                    {group.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsCreatingCategory(true)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {hasFetched && (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={selectedContacts.size === 0 || isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                `Importar ${selectedContacts.size} contato${selectedContacts.size !== 1 ? 's' : ''}`
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
