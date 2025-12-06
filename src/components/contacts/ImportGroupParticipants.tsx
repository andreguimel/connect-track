import { useState, useEffect } from 'react';
import { Users, Loader2, UserCheck, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWhatsAppContacts, WhatsAppContact } from '@/hooks/useWhatsAppContacts';
import { useGroups } from '@/hooks/useData';

interface ImportGroupParticipantsProps {
  isOpen: boolean;
  onClose: () => void;
  instanceId: string;
  groupJid: string;
  groupName: string;
  onImportComplete?: () => void;
}

export function ImportGroupParticipants({
  isOpen,
  onClose,
  instanceId,
  groupJid,
  groupName,
  onImportComplete,
}: ImportGroupParticipantsProps) {
  const { contacts, loading, fetchGroupParticipants, importContacts, clearContacts } = useWhatsAppContacts();
  const { groups } = useGroups();

  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (isOpen && instanceId && groupJid) {
      fetchGroupParticipants(instanceId, groupJid).then(() => {
        setHasFetched(true);
      });
    }
  }, [isOpen, instanceId, groupJid, fetchGroupParticipants]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedContacts(new Set());
      setSelectedGroupId('');
      setHasFetched(false);
      clearContacts();
    }
  }, [isOpen, clearContacts]);

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
    onClose();
    onImportComplete?.();
  };

  const newContactsCount = contacts.filter(c => !c.alreadyExists).length;
  const existingContactsCount = contacts.filter(c => c.alreadyExists).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Importar Participantes do Grupo</DialogTitle>
          <DialogDescription>
            Extraindo participantes do grupo "{groupName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading && !hasFetched ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Buscando participantes...</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {contacts.length} participantes
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
                    Nenhum participante encontrado
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
                            {contact.phoneNumber}
                            {contact.isAdmin && (
                              <span className="ml-2 text-xs text-primary">(Admin)</span>
                            )}
                          </p>
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
                  <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sem categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sem categoria</SelectItem>
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
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedContacts.size === 0 || isImporting || loading}
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
