import { useState } from 'react';
import { Building2, Plus, Trash2, RefreshCw, CheckCircle, XCircle, ExternalLink, Loader2, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWhatsAppBusiness, WhatsAppBusinessAccount } from '@/hooks/useWhatsAppBusiness';
import { useSubscription } from '@/hooks/useSubscription';

export const WhatsAppBusinessConfig = () => {
  const { accounts, loading, createAccount, deleteAccount, fetchAccounts, syncTemplatesFromMeta } = useWhatsAppBusiness();
  const { subscription } = useSubscription();
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPremium = subscription?.plan_type === 'premium';

  const handleAddAccount = async () => {
    if (!name || !phoneNumberId || !businessAccountId || !accessToken) {
      return;
    }

    setIsSubmitting(true);
    const result = await createAccount(name, phoneNumberId, businessAccountId, accessToken);
    setIsSubmitting(false);

    if (result) {
      setName('');
      setPhoneNumberId('');
      setBusinessAccountId('');
      setAccessToken('');
      setIsAddingAccount(false);
    }
  };

  const handleDeleteAccount = async (account: WhatsAppBusinessAccount) => {
    if (!confirm(`Tem certeza que deseja remover a conta "${account.name}"?`)) return;
    
    setIsDeleting(account.id);
    await deleteAccount(account.id);
    setIsDeleting(null);
  };

  const handleSyncTemplates = async (accountId: string) => {
    setIsSyncing(accountId);
    await syncTemplatesFromMeta(accountId);
    setIsSyncing(null);
  };

  if (!isPremium) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            API Oficial do WhatsApp Business
          </CardTitle>
          <CardDescription>
            Recurso exclusivo do plano Premium
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Com a API Oficial você pode:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Enviar mensagens com <strong>botões interativos</strong></li>
              <li>Criar <strong>listas de opções</strong></li>
              <li>Usar <strong>templates aprovados</strong> pelo WhatsApp</li>
              <li>Maior <strong>limite de mensagens</strong></li>
              <li><strong>Sem risco de banimento</strong></li>
            </ul>
          </div>
          <Button className="w-full" disabled>
            <Crown className="h-4 w-4 mr-2" />
            Fazer Upgrade para Premium
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              API Oficial do WhatsApp Business
            </CardTitle>
            <CardDescription>
              Conecte sua conta Business para enviar mensagens com botões e templates
            </CardDescription>
          </div>
          <Dialog open={isAddingAccount} onOpenChange={setIsAddingAccount}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Conta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Conectar Conta Business</DialogTitle>
                <DialogDescription>
                  Insira as credenciais da sua conta WhatsApp Business API
                </DialogDescription>
              </DialogHeader>
              
              <Alert>
                <ExternalLink className="h-4 w-4" />
                <AlertDescription>
                  Obtenha suas credenciais no{' '}
                  <a 
                    href="https://developers.facebook.com/apps" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Meta for Developers
                  </a>
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da conexão</Label>
                  <Input
                    id="name"
                    placeholder="Ex: WhatsApp Principal"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                  <Input
                    id="phoneNumberId"
                    placeholder="Ex: 123456789012345"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="businessAccountId">WhatsApp Business Account ID</Label>
                  <Input
                    id="businessAccountId"
                    placeholder="Ex: 123456789012345"
                    value={businessAccountId}
                    onChange={(e) => setBusinessAccountId(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="accessToken">Access Token</Label>
                  <Input
                    id="accessToken"
                    type="password"
                    placeholder="Token de acesso permanente"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingAccount(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleAddAccount} 
                  disabled={isSubmitting || !name || !phoneNumberId || !businessAccountId || !accessToken}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    'Conectar'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma conta Business conectada</p>
            <p className="text-sm">Clique em "Adicionar Conta" para começar</p>
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <div 
                key={account.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {account.name}
                      {account.status === 'active' ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {account.phone_number || 'Número não verificado'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSyncTemplates(account.id)}
                    disabled={isSyncing === account.id}
                  >
                    {isSyncing === account.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Sincronizar Templates
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteAccount(account)}
                    disabled={isDeleting === account.id}
                  >
                    {isDeleting === account.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
