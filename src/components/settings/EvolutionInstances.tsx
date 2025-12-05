import { useState, useEffect, useCallback } from 'react';
import { Plus, Wifi, WifiOff, Trash2, RefreshCw, QrCode, Phone, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useEvolutionInstances, EvolutionInstance } from '@/hooks/useEvolutionInstances';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function EvolutionInstances() {
  const { toast } = useToast();
  const { 
    instances, 
    loading, 
    createInstance, 
    getQRCode, 
    checkStatus, 
    disconnectInstance, 
    deleteInstance 
  } = useEvolutionInstances();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<EvolutionInstance | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<EvolutionInstance | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
  
  const [newInstance, setNewInstance] = useState({
    name: '',
    api_url: '',
    api_key: '',
  });

  // Auto-refresh status for connecting instances
  useEffect(() => {
    const connectingInstances = instances.filter(i => i.status === 'connecting');
    if (connectingInstances.length === 0) return;

    const interval = setInterval(async () => {
      for (const instance of connectingInstances) {
        await checkStatus(instance);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [instances, checkStatus]);

  // Check status when QR dialog is open
  useEffect(() => {
    if (!showQRDialog || !selectedInstance) return;

    const interval = setInterval(async () => {
      const status = await checkStatus(selectedInstance);
      if (status === 'connected') {
        setShowQRDialog(false);
        setQrCode(null);
        toast({
          title: 'Conectado!',
          description: `${selectedInstance.name} conectado com sucesso.`,
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [showQRDialog, selectedInstance, checkStatus, toast]);

  const handleCreate = async () => {
    if (!newInstance.name || !newInstance.api_url || !newInstance.api_key) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    const result = await createInstance(newInstance);
    setIsCreating(false);

    if (result) {
      setShowAddDialog(false);
      setNewInstance({ name: '', api_url: '', api_key: '' });
      
      // Show QR code if available
      if (result.qrcode?.base64) {
        setSelectedInstance(result.instance);
        setQrCode(result.qrcode.base64);
        setShowQRDialog(true);
      }
      
      toast({
        title: 'Instância criada',
        description: 'Escaneie o QR Code para conectar.',
      });
    }
  };

  const handleGetQR = async (instance: EvolutionInstance) => {
    setSelectedInstance(instance);
    setIsLoadingQR(true);
    setShowQRDialog(true);
    
    const qr = await getQRCode(instance);
    setIsLoadingQR(false);
    
    if (qr) {
      setQrCode(qr);
    }
  };

  const handleCheckStatus = async (instance: EvolutionInstance) => {
    setCheckingStatus(instance.id);
    await checkStatus(instance);
    setCheckingStatus(null);
  };

  const handleDelete = async () => {
    if (!showDeleteDialog) return;
    await deleteInstance(showDeleteDialog);
    setShowDeleteDialog(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
            <Wifi className="h-3 w-3" />
            Conectado
          </span>
        );
      case 'connecting':
        return (
          <span className="flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
            <Loader2 className="h-3 w-3 animate-spin" />
            Conectando
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <WifiOff className="h-3 w-3" />
            Desconectado
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {instances.length}/3 conexões
          </p>
        </div>
        <Button 
          onClick={() => setShowAddDialog(true)} 
          disabled={instances.length >= 3}
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova Conexão
        </Button>
      </div>

      {/* Instances List */}
      {instances.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
          <Phone className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 font-medium text-foreground">Nenhuma conexão</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Adicione uma conexão para enviar mensagens
          </p>
          <Button 
            onClick={() => setShowAddDialog(true)} 
            className="mt-4"
            variant="outline"
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Conexão
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {instances.map((instance) => (
            <div 
              key={instance.id} 
              className="flex items-center justify-between rounded-lg border bg-background p-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{instance.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {instance.instance_name}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {getStatusBadge(instance.status)}
                
                <div className="flex gap-1">
                  {instance.status !== 'connected' && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleGetQR(instance)}
                      title="Gerar QR Code"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCheckStatus(instance)}
                    disabled={checkingStatus === instance.id}
                    title="Verificar status"
                  >
                    <RefreshCw className={`h-4 w-4 ${checkingStatus === instance.id ? 'animate-spin' : ''}`} />
                  </Button>
                  
                  {instance.status === 'connected' && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => disconnectInstance(instance)}
                      title="Desconectar"
                    >
                      <WifiOff className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowDeleteDialog(instance)}
                    className="text-muted-foreground hover:text-destructive"
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Instance Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Conexão WhatsApp</DialogTitle>
            <DialogDescription>
              Configure uma nova instância da Evolution API
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Nome da Conexão</Label>
              <Input
                id="new-name"
                value={newInstance.name}
                onChange={(e) => setNewInstance(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Meu WhatsApp Principal"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-url">URL da Evolution API</Label>
              <Input
                id="new-url"
                value={newInstance.api_url}
                onChange={(e) => setNewInstance(prev => ({ ...prev, api_url: e.target.value }))}
                placeholder="https://sua-evolution.com"
                className="font-mono text-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-key">API Key</Label>
              <Input
                id="new-key"
                type="password"
                value={newInstance.api_key}
                onChange={(e) => setNewInstance(prev => ({ ...prev, api_key: e.target.value }))}
                placeholder="sua-api-key"
                className="font-mono text-sm"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Conexão
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={showQRDialog} onOpenChange={(open) => {
        setShowQRDialog(open);
        if (!open) setQrCode(null);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu WhatsApp
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center justify-center py-6">
            {isLoadingQR ? (
              <div className="flex h-64 w-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : qrCode ? (
              <div className="rounded-lg bg-white p-4">
                <img 
                  src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code" 
                  className="h-64 w-64"
                />
              </div>
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">Erro ao carregar QR Code</p>
              </div>
            )}
            
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Abra o WhatsApp no seu celular → Configurações → Aparelhos Conectados → Conectar
            </p>
            
            {selectedInstance?.status === 'connecting' && (
              <div className="mt-4 flex items-center gap-2 text-sm text-warning">
                <Loader2 className="h-4 w-4 animate-spin" />
                Aguardando conexão...
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => selectedInstance && handleGetQR(selectedInstance)}
              disabled={isLoadingQR}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingQR ? 'animate-spin' : ''}`} />
              Novo QR Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover conexão?</AlertDialogTitle>
            <AlertDialogDescription>
              A instância "{showDeleteDialog?.name}" será removida permanentemente da Evolution API e desta conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
