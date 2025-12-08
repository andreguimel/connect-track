import { useState, useEffect } from 'react';
import { Smartphone, Loader2, UserCheck, UserPlus, Users, UsersRound, Lock, Plus } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useEvolutionInstances } from '@/hooks/useEvolutionInstances';
import { useWhatsAppContacts, WhatsAppContact } from '@/hooks/useWhatsAppContacts';
import { useWhatsAppGroups, WhatsAppGroup } from '@/hooks/useWhatsAppGroups';
import { useGroups } from '@/hooks/useData';
import { useSubscription } from '@/hooks/useSubscription';

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

interface ImportWhatsAppContactsProps {
  onImportComplete?: () => void;
}

export function ImportWhatsAppContacts({ onImportComplete }: ImportWhatsAppContactsProps) {
  const { instances, fetchInstances } = useEvolutionInstances();
  const { contacts, loading, fetchWhatsAppContacts, fetchGroupParticipants, importContacts, clearContacts } = useWhatsAppContacts();
  const { groups: whatsappGroups, syncing, syncGroups, fetchGroups } = useWhatsAppGroups();
  const { groups: categories, addGroup } = useGroups();
  const { getLimits } = useSubscription();
  const limits = getLimits();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('contacts');
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  
  // Group tab state
  const [selectedWhatsAppGroup, setSelectedWhatsAppGroup] = useState<WhatsAppGroup | null>(null);
  const [hasFetchedGroups, setHasFetchedGroups] = useState(false);
  
  // New category state
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);

  const connectedInstances = instances.filter(i => i.status === 'connected');

  useEffect(() => {
    if (isOpen) {
      fetchInstances();
    }
  }, [isOpen, fetchInstances]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedInstance('');
      setSelectedContacts(new Set());
      setSelectedGroupId('');
      setHasFetched(false);
      setHasFetchedGroups(false);
      setSelectedWhatsAppGroup(null);
      setActiveTab('contacts');
      clearContacts();
    }
  }, [isOpen, clearContacts]);

  // When instance changes, reset state
  useEffect(() => {
    setHasFetched(false);
    setHasFetchedGroups(false);
    setSelectedWhatsAppGroup(null);
    setSelectedContacts(new Set());
    clearContacts();
  }, [selectedInstance, clearContacts]);

  const handleFetchContacts = async () => {
    if (!selectedInstance) return;
    console.log('Calling fetchWhatsAppContacts with instanceId:', selectedInstance);
    const result = await fetchWhatsAppContacts(selectedInstance);
    console.log('Fetched contacts result:', result.length, 'contacts');
    setHasFetched(true);
  };

  const handleSyncGroups = async () => {
    if (!selectedInstance) return;
    await syncGroups(selectedInstance);
    setHasFetchedGroups(true);
  };

  const handleSelectWhatsAppGroup = async (group: WhatsAppGroup) => {
    setSelectedWhatsAppGroup(group);
    setSelectedContacts(new Set());
    await fetchGroupParticipants(selectedInstance, group.group_jid);
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

  const handleImport = async () => {
    const contactsToImport = contacts.filter(c => selectedContacts.has(c.phoneNumber));
    if (contactsToImport.length === 0) return;

    setIsImporting(true);
    await importContacts(contactsToImport, selectedGroupId || undefined);
    setIsImporting(false);
    setIsOpen(false);
    onImportComplete?.();
  };

  const newContactsCount = contacts.filter(c => !c.alreadyExists).length;
  const existingContactsCount = contacts.filter(c => c.alreadyExists).length;

  const renderContactsList = () => (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-4 w-4" />
            {contacts.length} contatos encontrados
          </span>
          {newContactsCount > 0 && (
            <span className="flex items-center gap-1 text-success">
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
        </div>
        {newContactsCount > 0 && (
          <Button variant="ghost" size="sm" onClick={selectAllNew}>
            {selectedContacts.size === newContactsCount ? 'Desmarcar todos' : 'Selecionar novos'}
          </Button>
        )}
      </div>

      <ScrollArea className="h-64 rounded-lg border bg-background">
        {contacts.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Nenhum contato encontrado
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {contacts.map((contact) => (
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
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {contact.name || 'Sem nome'}
                    {contact.isAdmin && (
                      <span className="ml-2 text-xs text-primary">(Admin)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{contact.phoneNumber}</p>
                </div>
                {contact.alreadyExists && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
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
        <div className="space-y-2">
          <Label>Categoria para importar (opcional)</Label>
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
    </>
  );

  // If import is disabled during trial, show locked button
  if (!limits.canImportWhatsApp) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" disabled className="opacity-60">
              <Lock className="mr-2 h-4 w-4" />
              Importar do WhatsApp
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Disponível apenas para assinantes</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Smartphone className="mr-2 h-4 w-4" />
          Importar do WhatsApp
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Importar Contatos do WhatsApp</DialogTitle>
          <DialogDescription>
            Extraia contatos diretamente da sua conta do WhatsApp conectada
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Instance Selection */}
          <div className="space-y-2">
            <Label>Selecione a conexão WhatsApp</Label>
            {connectedInstances.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma conexão disponível. Conecte seu WhatsApp nas Configurações.
              </p>
            ) : (
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conexão" />
                </SelectTrigger>
                <SelectContent>
                  {connectedInstances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      {instance.name} {instance.phone_number && `(${instance.phone_number})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Tabs for Contacts vs Groups */}
          {selectedInstance && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="contacts" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Contatos
                </TabsTrigger>
                <TabsTrigger value="groups" className="flex items-center gap-2">
                  <UsersRound className="h-4 w-4" />
                  Grupos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="contacts" className="space-y-4 mt-4">
                {!hasFetched ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-4">
                    <p className="text-sm text-muted-foreground">
                      Clique para buscar os contatos do WhatsApp
                    </p>
                    <Button onClick={handleFetchContacts} disabled={loading}>
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
                  renderContactsList()
                )}
              </TabsContent>

              <TabsContent value="groups" className="space-y-4 mt-4">
                {!hasFetchedGroups && !selectedWhatsAppGroup ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-4">
                    <p className="text-sm text-muted-foreground">
                      Sincronize os grupos do WhatsApp para extrair participantes
                    </p>
                    <Button onClick={handleSyncGroups} disabled={syncing}>
                      {syncing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        'Sincronizar Grupos'
                      )}
                    </Button>
                  </div>
                ) : selectedWhatsAppGroup ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          setSelectedWhatsAppGroup(null);
                          setSelectedContacts(new Set());
                          clearContacts();
                        }}
                      >
                        ← Voltar
                      </Button>
                      <span className="font-medium">{selectedWhatsAppGroup.name}</span>
                    </div>
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="ml-2 text-muted-foreground">Buscando participantes...</span>
                      </div>
                    ) : (
                      renderContactsList()
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">
                        {whatsappGroups.length} grupos encontrados
                      </span>
                      <Button variant="ghost" size="sm" onClick={handleSyncGroups} disabled={syncing}>
                        {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Atualizar'}
                      </Button>
                    </div>
                    <ScrollArea className="h-64 rounded-lg border bg-background">
                      {whatsappGroups.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          Nenhum grupo encontrado
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {whatsappGroups
                            .filter(g => g.instance_id === selectedInstance)
                            .map((group) => (
                            <div
                              key={group.id}
                              className="flex items-center gap-3 rounded-md p-3 hover:bg-accent/50 cursor-pointer"
                              onClick={() => handleSelectWhatsAppGroup(group)}
                            >
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <UsersRound className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-sm">{group.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {group.participants_count || 0} participantes
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
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
              `Importar ${selectedContacts.size} contatos`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
