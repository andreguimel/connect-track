import { useState, useEffect, useCallback, useRef } from 'react';
import { Wifi, WifiOff, Trash2, RefreshCw, QrCode, Phone, Loader2, Pencil, Check, X, AlertTriangle, Briefcase, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useEvolutionInstances, EvolutionInstance, IntegrationType } from '@/hooks/useEvolutionInstances';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
    deleteInstance,
    renameInstance 
  } = useEvolutionInstances();
  
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<EvolutionInstance | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<EvolutionInstance | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
  const [editingInstance, setEditingInstance] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [reconnectingInstance, setReconnectingInstance] = useState<string | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  
  // Track previous statuses to detect disconnections
  const previousStatusesRef = useRef<Record<string, string>>({});
  
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

  // Heartbeat: periodic status check for all instances (every 30 seconds)
  useEffect(() => {
    if (instances.length === 0) return;

    const interval = setInterval(async () => {
      for (const instance of instances) {
        if (instance.status === 'connected') {
          await checkStatus(instance);
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [instances, checkStatus]);

  // Detect disconnections and show toast
  useEffect(() => {
    instances.forEach((instance) => {
      const prevStatus = previousStatusesRef.current[instance.id];
      if (prevStatus === 'connected' && instance.status === 'disconnected') {
        toast({
          title: 'Conexão perdida',
          description: `${instance.name} foi desconectado. Clique em "Reconectar" para gerar um novo QR Code.`,
          variant: 'destructive',
        });
      }
      previousStatusesRef.current[instance.id] = instance.status;
    });
  }, [instances, toast]);

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

  const handleCreate = async (integrationType: IntegrationType = 'WHATSAPP-BAILEYS') => {
    setShowTypeSelector(false);
    setIsCreating(true);
    
    const result = await createInstance(undefined, integrationType);
    
    setIsCreating(false);

    if (result) {
      // Show QR code immediately
      if (result.qrcode?.base64) {
        setSelectedInstance(result.instance);
        setQrCode(result.qrcode.base64);
        setShowQRDialog(true);
      } else {
        // If no QR in create response, fetch it
        setSelectedInstance(result.instance);
        setShowQRDialog(true);
        setIsLoadingQR(true);
        const qr = await getQRCode(result.instance);
        setIsLoadingQR(false);
        if (qr) setQrCode(qr);
      }
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

  const handleReconnect = async (instance: EvolutionInstance) => {
    setReconnectingInstance(instance.id);
    setSelectedInstance(instance);
    setShowQRDialog(true);
    setIsLoadingQR(true);
    
    const qr = await getQRCode(instance);
    setIsLoadingQR(false);
    setReconnectingInstance(null);
    
    if (qr) {
      setQrCode(qr);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteDialog) return;
    await deleteInstance(showDeleteDialog);
    setShowDeleteDialog(null);
  };

  // Check if there are any disconnected instances that were previously connected
  const hasDisconnectedInstances = instances.some(i => i.status === 'disconnected');

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
      {/* Disconnection Alert */}
      {hasDisconnectedInstances && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            Uma ou mais conexões foram perdidas. Use o botão "Reconectar" para gerar um novo QR Code.
          </AlertDescription>
        </Alert>
      )}

      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {instances.length}/3 conexões
          </p>
        </div>
        <Button 
          onClick={() => setShowTypeSelector(true)} 
          disabled={instances.length >= 3 || isCreating}
          size="sm"
        >
          {isCreating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Conectando...
            </>
          ) : (
            <>
              <QrCode className="mr-2 h-4 w-4" />
              Conectar WhatsApp
            </>
          )}
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
            onClick={() => setShowTypeSelector(true)} 
            className="mt-4"
            variant="outline"
            disabled={isCreating}
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <QrCode className="mr-2 h-4 w-4" />
                Conectar WhatsApp
              </>
            )}
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
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  instance.integration_type === 'WHATSAPP-BUSINESS-BAILEYS' 
                    ? 'bg-emerald-500/10' 
                    : 'bg-primary/10'
                }`}>
                  {instance.integration_type === 'WHATSAPP-BUSINESS-BAILEYS' ? (
                    <Briefcase className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Phone className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div>
                  {editingInstance === instance.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 w-40"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            renameInstance(instance, editName);
                            setEditingInstance(null);
                          } else if (e.key === 'Escape') {
                            setEditingInstance(null);
                          }
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          renameInstance(instance, editName);
                          setEditingInstance(null);
                        }}
                      >
                        <Check className="h-4 w-4 text-success" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditingInstance(null)}
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{instance.name}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setEditingInstance(instance.id);
                          setEditName(instance.name);
                        }}
                        title="Editar nome"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground font-mono">
                      {instance.instance_name}
                    </p>
                    {instance.integration_type === 'WHATSAPP-BUSINESS-BAILEYS' && (
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                        Business
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {getStatusBadge(instance.status)}
                
                <div className="flex gap-1">
                  {instance.status === 'disconnected' && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleReconnect(instance)}
                      disabled={reconnectingInstance === instance.id}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {reconnectingInstance === instance.id ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Reconectando...
                        </>
                      ) : (
                        <>
                          <QrCode className="mr-1.5 h-3.5 w-3.5" />
                          Reconectar
                        </>
                      )}
                    </Button>
                  )}

                  {instance.status === 'connecting' && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleGetQR(instance)}
                      title="Ver QR Code"
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

      {/* WhatsApp Type Selector Dialog */}
      <Dialog open={showTypeSelector} onOpenChange={setShowTypeSelector}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Qual tipo de WhatsApp você quer conectar?
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <button
              onClick={() => handleCreate('WHATSAPP-BAILEYS')}
              className="flex flex-col items-center gap-3 rounded-lg border-2 border-border bg-background p-6 transition-all hover:border-primary hover:bg-primary/5"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Smartphone className="h-7 w-7 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">WhatsApp Normal</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Para contas pessoais
                </p>
              </div>
            </button>
            
            <button
              onClick={() => handleCreate('WHATSAPP-BUSINESS-BAILEYS')}
              className="flex flex-col items-center gap-3 rounded-lg border-2 border-border bg-background p-6 transition-all hover:border-emerald-500 hover:bg-emerald-500/5"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                <Briefcase className="h-7 w-7 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">WhatsApp Business</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Para o app Business (verde)
                </p>
              </div>
            </button>
          </div>
          
          <p className="text-center text-xs text-muted-foreground">
            Ambos usam QR Code para conexão. Escolha baseado no app instalado no seu celular.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
