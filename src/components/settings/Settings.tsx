import { useState } from 'react';
import { Settings as SettingsIcon, Webhook, Save, ExternalLink, Zap, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface SettingsProps {
  webhookUrl: string;
  onWebhookChange: (url: string) => void;
}

export function Settings({ webhookUrl, onWebhookChange }: SettingsProps) {
  const { toast } = useToast();
  const [localWebhookUrl, setLocalWebhookUrl] = useState(webhookUrl);

  const handleSave = () => {
    onWebhookChange(localWebhookUrl);
    toast({
      title: "Configurações salvas",
      description: "As configurações foram atualizadas com sucesso",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Configurações</h1>
        <p className="mt-1 text-muted-foreground">
          Configure as integrações e preferências do sistema
        </p>
      </div>

      {/* n8n Integration */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
            <Zap className="h-6 w-6 text-accent-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold text-foreground">
              Integração n8n
            </h2>
            <p className="mt-1 text-muted-foreground">
              Configure o webhook do n8n para automatizar o envio de mensagens
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
                className="flex-1"
              />
              <Button onClick={handleSave}>
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
                <p className="font-medium text-info">Como configurar o n8n</p>
                <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
                  <li>Crie um novo workflow no n8n</li>
                  <li>Adicione um nó "Webhook" como trigger</li>
                  <li>Configure o método como POST</li>
                  <li>Copie a URL do webhook e cole aqui</li>
                  <li>Adicione nós para enviar mensagens WhatsApp (Evolution API, Baileys, etc.)</li>
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
  "message": "Mensagem a ser enviada",
  "timestamp": "2024-01-01T00:00:00.000Z"
}`}
            </pre>
          </div>
        </div>
      </div>

      {/* Status Webhook (optional) */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
            <Webhook className="h-6 w-6 text-secondary-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold text-foreground">
              Webhook de Status (Opcional)
            </h2>
            <p className="mt-1 text-muted-foreground">
              Receba atualizações de status de entrega das mensagens
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-warning/20 bg-warning/5 p-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 shrink-0 text-warning" />
            <div className="text-sm text-muted-foreground">
              <p>
                Para receber atualizações de status (entregue, lido, etc.), configure seu 
                workflow n8n para enviar callbacks de volta para esta aplicação.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl font-semibold text-foreground">Sobre</h2>
        <p className="mt-2 text-muted-foreground">
          ZapSender é uma aplicação para envio de mensagens em massa via WhatsApp, 
          utilizando n8n como backend para processamento e envio.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            React
          </span>
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            TypeScript
          </span>
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            n8n
          </span>
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            WhatsApp
          </span>
        </div>
      </div>
    </div>
  );
}
