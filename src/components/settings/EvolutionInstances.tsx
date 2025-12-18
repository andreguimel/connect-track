import { useState, useEffect, useCallback, useRef } from 'react';
import { Wifi, WifiOff, Trash2, RefreshCw, QrCode, Phone, Loader2, Pencil, Check, X, AlertTriangle, Building2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useEvolutionInstances, EvolutionInstance, IntegrationType } from '@/hooks/useEvolutionInstances';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showBusinessPhoneDialog, setShowBusinessPhoneDialog] = useState(false);
  const [businessPhoneNumber, setBusinessPhoneNumber] = useState('');
  const [selectedInstance, setSelectedInstance] = useState<EvolutionInstance | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
  const [editingInstance, setEditingInstance] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [reconnectingInstance, setReconnectingInstance] = useState<string | null>(null);
  
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

  // Heartbeat: periodic status check for ALL instances (every 15 seconds)
  // This ensures disconnected instances are detected quickly
  useEffect(() => {
    if (instances.length === 0) return;

    const interval = setInterval(async () => {
      for (const instance of instances) {
        // Check all instances to detect disconnections
        await checkStatus(instance);
      }
    }, 15000);

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

  const handleCreate = async (integrationType: IntegrationType = 'WHATSAPP-BAILEYS', phoneNumber?: string) => {
    setIsCreating(true);
    setShowTypeSelector(false);
    setShowBusinessPhoneDialog(false);
    
    const result = await createInstance(undefined, integrationType, phoneNumber);
    
    setIsCreating(false);
    setBusinessPhoneNumber('');

    if (result) {
      // If already connected (common for WhatsApp Business), show success toast
      if (result.alreadyConnected) {
        toast({
          title: 'Conectado!',
          description: `${result.instance.name} conectado com sucesso.`,
        });
        return;
      }
      
      // For business with pairing code
      if (result.pairingCode) {
        setPairingCode(result.pairingCode);
        setSelectedInstance(result.instance);
        setShowQRDialog(true);
        return;
      }
      
      // Show QR code immediately (for normal WhatsApp)
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

  const handleBusinessCreate = () => {
    if (!businessPhoneNumber.trim()) {
      toast({
        title: 'Número obrigatório',
        description: 'Informe o número do WhatsApp Business.',
        variant: 'destructive',
      });
      return;
    }
    handleCreate('WHATSAPP-BUSINESS-BAILEYS', businessPhoneNumber);
  };

  const handleGetQR = async (instance: EvolutionInstance) => {
    setSelectedInstance(instance);
    setIsLoadingQR(true);
    setShowQRDialog(true);
    
    const qr = await getQRCode(instance);
    setIsLoadingQR(false);
    
    if (qr) {
      setQrCode(qr);
    } else {
      // No QR code returned - might be a Business instance
      toast({
        title: 'QR Code não disponível',
        description: 'Esta instância pode não suportar QR Code.',
        variant: 'destructive',
      });
      setShowQRDialog(false);
    }
  };

  const handleCheckStatus = async (instance: EvolutionInstance) => {
    setCheckingStatus(instance.id);
    await checkStatus(instance);
    setCheckingStatus(null);
  };

  const handleReconnect = async (instance: EvolutionInstance) => {
    const isBusinessApp = instance.integration_type === 'WHATSAPP-BUSINESS-BAILEYS';
    
    // For Business instances, show phone number dialog instead of QR code
    if (isBusinessApp) {
      setBusinessPhoneNumber(instance.phone_number || '');
      setShowBusinessPhoneDialog(true);
      // Delete old instance and create new one with same number
      await deleteInstance(instance);
      return;
    }
    
    setReconnectingInstance(instance.id);
    setSelectedInstance(instance);
    setShowQRDialog(true);
    setIsLoadingQR(true);
    
    const qr = await getQRCode(instance);
    setIsLoadingQR(false);
    setReconnectingInstance(null);
    
    if (qr) {
      setQrCode(qr);
    } else {
      toast({
        title: 'QR Code não disponível',
        description: 'Não foi possível gerar o QR Code.',
        variant: 'destructive',
      });
      setShowQRDialog(false);
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

      {/* Header with Add Buttons */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {instances.length}/3 conexões
          </p>
        </div>
        <div className="flex gap-2">
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
            onClick={() => handleCreate('WHATSAPP-BAILEYS')} 
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
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Phone className="h-5 w-5 text-primary" />
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-muted-foreground font-mono">
                      {instance.instance_name}
                    </p>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      instance.integration_type === 'WHATSAPP-BUSINESS-BAILEYS' 
                        ? 'bg-emerald-500/10 text-emerald-600' 
                        : 'bg-blue-500/10 text-blue-600'
                    }`}>
                      {instance.integration_type === 'WHATSAPP-BUSINESS-BAILEYS' 
                        ? 'Business App' 
                        : 'WhatsApp Web'}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      via Evolution API
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end gap-1">
                  {getStatusBadge(instance.status)}
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(instance.updated_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
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

      {/* QR Code / Pairing Code Dialog */}
      <Dialog open={showQRDialog} onOpenChange={(open) => {
        setShowQRDialog(open);
        if (!open) {
          setQrCode(null);
          setPairingCode(null);
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              {pairingCode ? 'Use o código de pareamento no seu WhatsApp Business' : 'Escaneie o QR Code com seu WhatsApp'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center justify-center py-6">
            {isLoadingQR ? (
              <div className="flex h-64 w-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pairingCode ? (
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-lg bg-emerald-500/10 px-8 py-6">
                  <p className="text-center font-mono text-4xl font-bold tracking-widest text-emerald-600">
                    {pairingCode}
                  </p>
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  <p>1. Abra o WhatsApp Business</p>
                  <p>2. Vá em Configurações → Aparelhos Conectados</p>
                  <p>3. Toque em "Conectar um aparelho"</p>
                  <p>4. Escolha "Conectar com número de telefone"</p>
                  <p>5. Digite o código acima</p>
                </div>
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
            
            {!pairingCode && (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Abra o WhatsApp no seu celular → Configurações → Aparelhos Conectados → Conectar
              </p>
            )}
            
            {selectedInstance?.status === 'connecting' && (
              <div className="mt-4 flex items-center gap-2 text-sm text-warning">
                <Loader2 className="h-4 w-4 animate-spin" />
                Aguardando conexão...
              </div>
            )}
          </div>
          
          <DialogFooter>
            {!pairingCode && (
              <Button 
                variant="outline" 
                onClick={() => selectedInstance && handleGetQR(selectedInstance)}
                disabled={isLoadingQR}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingQR ? 'animate-spin' : ''}`} />
                Novo QR Code
              </Button>
            )}
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

      {/* Type Selector Dialog */}
      <Dialog open={showTypeSelector} onOpenChange={setShowTypeSelector}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Escolha o tipo de conexão</DialogTitle>
            <DialogDescription>
              Selecione qual WhatsApp deseja conectar
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <Button
              variant="outline"
              className="h-auto flex-col items-start gap-2 p-4 text-left"
              onClick={() => {
                setShowTypeSelector(false);
                handleCreate('WHATSAPP-BAILEYS');
              }}
            >
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                <span className="font-medium">WhatsApp Normal</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Conecta via QR Code - WhatsApp padrão ou pessoal
              </span>
            </Button>
            
            <Button
              variant="outline"
              className="h-auto flex-col items-start gap-2 p-4 text-left"
              onClick={() => {
                setShowTypeSelector(false);
                // WhatsApp Business App also uses QR Code (WHATSAPP-BAILEYS)
                // The WHATSAPP-BUSINESS integration is for Cloud API (requires Meta Business Manager)
                handleCreate('WHATSAPP-BAILEYS');
              }}
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-600" />
                <span className="font-medium">WhatsApp Business App</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Conecta via QR Code - Aplicativo WhatsApp Business
              </span>
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground text-center">
            Ambos conectam via QR Code. Abra o WhatsApp → Configurações → Aparelhos Conectados
          </p>
        </DialogContent>
      </Dialog>

    </div>
  );
}
