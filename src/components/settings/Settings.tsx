import { useState, useEffect } from 'react';
import { Save, Zap, Info, Shield, Clock, AlertTriangle, Send, CheckCircle, XCircle, Loader2, Wifi, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  AntiBanSettings, 
  defaultAntiBanSettings, 
  getAntiBanSettings, 
  saveAntiBanSettings,
  getDailySentCount,
  getRemainingDaily
} from '@/lib/antiban';

interface SettingsProps {
  webhookUrl: string;
  onWebhookChange: (url: string) => void;
}

export interface EvolutionSettings {
  apiUrl: string;
  instanceName: string;
  apiKey: string;
}

const EVOLUTION_STORAGE_KEY = 'zapsender_evolution_settings';

const defaultEvolutionSettings: EvolutionSettings = {
  apiUrl: '',
  instanceName: '',
  apiKey: '',
};

export const getEvolutionSettings = (): EvolutionSettings => {
  const stored = localStorage.getItem(EVOLUTION_STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return defaultEvolutionSettings;
};

export const saveEvolutionSettings = (settings: EvolutionSettings) => {
  localStorage.setItem(EVOLUTION_STORAGE_KEY, JSON.stringify(settings));
};

const N8N_WEBHOOK_URL = 'https://oito.codigopro.tech/webhook/70343adc-43eb-4015-9571-d382c00bb03b';

export function Settings({ webhookUrl, onWebhookChange }: SettingsProps) {
  const { toast } = useToast();
  const [localWebhookUrl, setLocalWebhookUrl] = useState(webhookUrl || N8N_WEBHOOK_URL);
  const [antiBanSettings, setAntiBanSettings] = useState<AntiBanSettings>(getAntiBanSettings);
  const [dailySent, setDailySent] = useState(getDailySentCount);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Olá! Esta é uma mensagem de teste do ZapSender.');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [evolutionSettings, setEvolutionSettings] = useState<EvolutionSettings>(getEvolutionSettings);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (!webhookUrl) {
      onWebhookChange(N8N_WEBHOOK_URL);
    }
  }, [webhookUrl, onWebhookChange]);

  const handleSaveEvolution = () => {
    if (!evolutionSettings.apiUrl || !evolutionSettings.instanceName || !evolutionSettings.apiKey) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos da Evolution API",
        variant: "destructive",
      });
      return;
    }
    saveEvolutionSettings(evolutionSettings);
    toast({
      title: "Conexão salva",
      description: "Configurações da Evolution API salvas com sucesso",
    });
  };

  const updateEvolution = (key: keyof EvolutionSettings, value: string) => {
    setEvolutionSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveWebhook = () => {
    onWebhookChange(localWebhookUrl);
    toast({
      title: "Webhook salvo",
      description: "URL do webhook atualizada com sucesso",
    });
  };

  const handleSaveAntiBan = () => {
    saveAntiBanSettings(antiBanSettings);
    toast({
      title: "Configurações anti-ban salvas",
      description: "As configurações de proteção foram atualizadas",
    });
  };

  const updateAntiBan = (key: keyof AntiBanSettings, value: number | boolean) => {
    setAntiBanSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleTestMessage = async () => {
    if (!testPhone) {
      toast({
        title: "Número obrigatório",
        description: "Digite o número de telefone para teste",
        variant: "destructive",
      });
      return;
    }

    if (!localWebhookUrl) {
      toast({
        title: "Webhook não configurado",
        description: "Configure o URL do webhook primeiro",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const payload = {
        campaignId: 'test-' + Date.now(),
        contactId: 'test-contact',
        phone: testPhone.replace(/\D/g, ''),
        name: 'Teste',
        message: testMessage,
        timestamp: new Date().toISOString(),
        isTest: true,
        // Evolution API settings
        evolutionApiUrl: evolutionSettings.apiUrl,
        evolutionInstance: evolutionSettings.instanceName,
        evolutionApiKey: evolutionSettings.apiKey,
      };

      console.log('Enviando mensagem de teste via proxy:', payload);

      const { data, error } = await supabase.functions.invoke('n8n-proxy', {
        body: {
          webhookUrl: localWebhookUrl,
          payload,
        },
      });

      if (error) throw error;

      console.log('Resposta do proxy:', data);

      if (data.success) {
        setTestResult('success');
        toast({
          title: "Teste enviado com sucesso!",
          description: `n8n respondeu com status ${data.status}`,
        });
      } else {
        throw new Error(data.error || `n8n retornou status ${data.status}`);
      }
    } catch (error) {
      console.error('Erro no teste:', error);
      setTestResult('error');
      toast({
        title: "Erro no teste",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const remaining = getRemainingDaily(antiBanSettings);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Configurações</h1>
        <p className="mt-1 text-muted-foreground">
          Configure as integrações e proteções anti-ban
        </p>
      </div>

      {/* Daily Status */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Envios Hoje</p>
              <p className="text-sm text-muted-foreground">
                {dailySent} enviados • {remaining} restantes
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{remaining}</p>
            <p className="text-xs text-muted-foreground">disponíveis</p>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-secondary">
          <div 
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, (dailySent / antiBanSettings.dailyLimit) * 100)}%` }}
          />
        </div>
      </div>

      {/* Evolution API Connection */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
            <Wifi className="h-6 w-6 text-success" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold text-foreground">
              Conexão Evolution API
            </h2>
            <p className="mt-1 text-muted-foreground">
              Configure a conexão com sua instância da Evolution API
            </p>
          </div>
          {evolutionSettings.apiUrl && evolutionSettings.instanceName && evolutionSettings.apiKey && (
            <div className="flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-success">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Conectado</span>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="evolution-url">URL da API</Label>
            <Input
              id="evolution-url"
              value={evolutionSettings.apiUrl}
              onChange={(e) => updateEvolution('apiUrl', e.target.value)}
              placeholder="https://sua-evolution-api.com"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">URL base da sua instância Evolution API</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="evolution-instance">Nome da Instância</Label>
            <Input
              id="evolution-instance"
              value={evolutionSettings.instanceName}
              onChange={(e) => updateEvolution('instanceName', e.target.value)}
              placeholder="minha-instancia"
            />
            <p className="text-xs text-muted-foreground">Nome da instância configurada na Evolution</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="evolution-apikey">API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="evolution-apikey"
                  type={showApiKey ? 'text' : 'password'}
                  value={evolutionSettings.apiKey}
                  onChange={(e) => updateEvolution('apiKey', e.target.value)}
                  placeholder="sua-api-key-evolution"
                  className="font-mono text-sm pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Chave de API da Evolution (Global API Key)</p>
          </div>
        </div>

        <Button onClick={handleSaveEvolution} className="mt-6">
          <Save className="mr-2 h-4 w-4" />
          Salvar Conexão
        </Button>

        {/* Info Box */}
        <div className="mt-4 rounded-lg border border-info/20 bg-info/5 p-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 shrink-0 text-info" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-info">Onde encontrar essas informações:</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li><strong>URL da API:</strong> Endereço onde sua Evolution está hospedada</li>
                <li><strong>Instância:</strong> Nome da instância conectada ao WhatsApp</li>
                <li><strong>API Key:</strong> Chave global nas configurações da Evolution</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Anti-Ban Settings */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
            <Shield className="h-6 w-6 text-destructive" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold text-foreground">
              Proteção Anti-Ban
            </h2>
            <p className="mt-1 text-muted-foreground">
              Configure delays e limites para evitar bloqueio do número
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="min-delay">Delay Mínimo (segundos)</Label>
            <Input
              id="min-delay"
              type="number"
              min={5}
              max={60}
              value={antiBanSettings.minDelaySeconds}
              onChange={(e) => updateAntiBan('minDelaySeconds', parseInt(e.target.value) || 8)}
            />
            <p className="text-xs text-muted-foreground">Mínimo 5s recomendado</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-delay">Delay Máximo (segundos)</Label>
            <Input
              id="max-delay"
              type="number"
              min={10}
              max={120}
              value={antiBanSettings.maxDelaySeconds}
              onChange={(e) => updateAntiBan('maxDelaySeconds', parseInt(e.target.value) || 25)}
            />
            <p className="text-xs text-muted-foreground">Variação aleatória entre min/max</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="daily-limit">Limite Diário</Label>
            <Input
              id="daily-limit"
              type="number"
              min={50}
              max={2000}
              value={antiBanSettings.dailyLimit}
              onChange={(e) => updateAntiBan('dailyLimit', parseInt(e.target.value) || 800)}
            />
            <p className="text-xs text-muted-foreground">500-800 recomendado para segurança</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch-size">Tamanho do Lote</Label>
            <Input
              id="batch-size"
              type="number"
              min={10}
              max={100}
              value={antiBanSettings.batchSize}
              onChange={(e) => updateAntiBan('batchSize', parseInt(e.target.value) || 50)}
            />
            <p className="text-xs text-muted-foreground">Pausa após cada lote</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch-pause">Pausa entre Lotes (minutos)</Label>
            <Input
              id="batch-pause"
              type="number"
              min={1}
              max={30}
              value={antiBanSettings.batchPauseMinutes}
              onChange={(e) => updateAntiBan('batchPauseMinutes', parseInt(e.target.value) || 5)}
            />
            <p className="text-xs text-muted-foreground">Tempo de descanso entre lotes</p>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-background p-4">
            <div>
              <Label htmlFor="random-variation">Variação Aleatória</Label>
              <p className="text-xs text-muted-foreground">Adiciona variação na mensagem</p>
            </div>
            <Switch
              id="random-variation"
              checked={antiBanSettings.enableRandomVariation}
              onCheckedChange={(checked) => updateAntiBan('enableRandomVariation', checked)}
            />
          </div>
        </div>

        <Button onClick={handleSaveAntiBan} className="mt-6">
          <Save className="mr-2 h-4 w-4" />
          Salvar Configurações Anti-Ban
        </Button>

        {/* Warning Box */}
        <div className="mt-4 rounded-lg border border-warning/20 bg-warning/5 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-warning">Dicas para evitar ban:</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Use delays de 8-25 segundos entre mensagens</li>
                <li>Não envie mais de 800 mensagens/dia por número</li>
                <li>Evite mensagens idênticas (use variáveis)</li>
                <li>Deixe o número "aquecer" por 2 semanas antes</li>
                <li>Tenha conversas normais no WhatsApp também</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* n8n Integration */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
            <Zap className="h-6 w-6 text-accent-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold text-foreground">
              Integração n8n + Evolution API
            </h2>
            <p className="mt-1 text-muted-foreground">
              Webhook configurado para envio via Evolution API
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">URL do Webhook</Label>
            <div className="flex gap-2">
              <Input
                id="webhook-url"
                value={localWebhookUrl}
                onChange={(e) => setLocalWebhookUrl(e.target.value)}
                placeholder="https://seu-n8n.com/webhook/..."
                className="flex-1 font-mono text-sm"
              />
              <Button onClick={handleSaveWebhook}>
                <Save className="mr-2 h-4 w-4" />
                Salvar
              </Button>
            </div>
          </div>

          {/* Info Box */}
          <div className="rounded-lg border border-info/20 bg-info/5 p-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 shrink-0 text-info" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-info">Configure no n8n:</p>
                <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
                  <li>Webhook recebe os dados (já configurado)</li>
                  <li>Adicione nó "Wait" com delay aleatório</li>
                  <li>Conecte com Evolution API (Send Message)</li>
                  <li>Configure instância e credenciais da Evolution</li>
                  <li>Ative o workflow</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Expected Payload */}
          <div className="rounded-lg border bg-secondary/50 p-4">
            <p className="text-sm font-medium text-foreground">Payload enviado ao webhook:</p>
            <pre className="mt-2 overflow-x-auto rounded bg-background p-3 text-xs text-muted-foreground">
{`{
  "campaignId": "uuid",
  "contactId": "uuid",
  "phone": "5511999999999",
  "name": "Nome do Contato",
  "message": "Mensagem personalizada",
  "timestamp": "2024-01-01T00:00:00.000Z"
}`}
            </pre>
          </div>
        </div>
      </div>

      {/* Test Message */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Send className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold text-foreground">
              Testar Integração
            </h2>
            <p className="mt-1 text-muted-foreground">
              Envie uma mensagem de teste para validar a conexão
            </p>
          </div>
          {testResult === 'success' && (
            <div className="flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-success">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Enviado</span>
            </div>
          )}
          {testResult === 'error' && (
            <div className="flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-destructive">
              <XCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Erro</span>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="test-phone">Número para Teste</Label>
            <Input
              id="test-phone"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="5511999999999"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">Inclua código do país (55 para Brasil)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-message">Mensagem de Teste</Label>
            <Input
              id="test-message"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Olá! Teste do ZapSender"
            />
          </div>
        </div>

        <Button 
          onClick={handleTestMessage} 
          className="mt-4 w-full sm:w-auto"
          disabled={isTesting || !testPhone}
        >
          {isTesting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Enviar Mensagem de Teste
            </>
          )}
        </Button>

        <p className="mt-3 text-xs text-muted-foreground">
          A mensagem será enviada via webhook para o n8n → Evolution API → WhatsApp
        </p>
      </div>

      {/* About */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl font-semibold text-foreground">Sobre</h2>
        <p className="mt-2 text-muted-foreground">
          ZapSender - Envio de mensagens em massa via WhatsApp com proteção anti-ban integrada.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            Evolution API
          </span>
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            n8n
          </span>
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            Anti-Ban
          </span>
        </div>
      </div>
    </div>
  );
}