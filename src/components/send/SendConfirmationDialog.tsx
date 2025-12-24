import { useState } from 'react';
import { AlertTriangle, Shield, MessageSquare, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getAntiBanSettings, calculateEstimatedTime, formatTimeRemaining } from '@/lib/antiban';

interface SendConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  recipientCount: number;
  isScheduled: boolean;
}

export function SendConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  recipientCount,
  isScheduled,
}: SendConfirmationDialogProps) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedResponsibility, setAcceptedResponsibility] = useState(false);

  const canConfirm = acceptedTerms && acceptedResponsibility;

  const antiBanSettings = getAntiBanSettings();
  const estimatedTimeSeconds = calculateEstimatedTime(recipientCount, 0, antiBanSettings);
  const estimatedTimeFormatted = formatTimeRemaining(estimatedTimeSeconds);

  const handleConfirm = () => {
    if (canConfirm) {
      setAcceptedTerms(false);
      setAcceptedResponsibility(false);
      onConfirm();
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setAcceptedTerms(false);
      setAcceptedResponsibility(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warning/20">
            <AlertTriangle className="h-7 w-7 text-warning" />
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Confirmar Envio em Massa
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Você está prestes a enviar mensagens para{' '}
            <span className="font-semibold text-foreground">{recipientCount} destinatários</span>
            {isScheduled ? ' (agendado)' : ''}.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4 space-y-4">
          {/* Estimated Time Box */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="font-medium text-foreground">Tempo Estimado</span>
              </div>
              <span className="text-lg font-bold text-primary">{estimatedTimeFormatted}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Baseado nas configurações anti-ban: {antiBanSettings.minDelaySeconds}-{antiBanSettings.maxDelaySeconds}s entre mensagens, 
              pausas de {antiBanSettings.batchPauseMinutes}min a cada {antiBanSettings.batchSize} envios
            </p>
          </div>

          {/* Warning Box */}
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
            <h4 className="mb-2 flex items-center gap-2 font-semibold text-warning">
              <Shield className="h-4 w-4" />
              Advertências Importantes
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                <span>
                  <strong>Risco de bloqueio:</strong> O envio em massa pode resultar no banimento
                  da sua conta do WhatsApp se violar os Termos de Serviço.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                <span>
                  <strong>Consentimento:</strong> Certifique-se de que todos os destinatários
                  consentiram em receber suas mensagens.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                <span>
                  <strong>LGPD:</strong> O tratamento de dados pessoais deve estar em conformidade
                  com a Lei Geral de Proteção de Dados.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                <span>
                  <strong>Anti-spam:</strong> Mensagens não solicitadas podem ser consideradas spam
                  e sujeitas a penalidades legais.
                </span>
              </li>
            </ul>
          </div>

          {/* Confirmation Checkboxes */}
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="terms"
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                className="mt-0.5"
              />
              <label
                htmlFor="terms"
                className="cursor-pointer text-sm leading-tight"
              >
                Li e compreendo as advertências acima. Declaro que os destinatários
                consentiram em receber minhas mensagens.
              </label>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="responsibility"
                checked={acceptedResponsibility}
                onCheckedChange={(checked) => setAcceptedResponsibility(checked === true)}
                className="mt-0.5"
              />
              <label
                htmlFor="responsibility"
                className="cursor-pointer text-sm leading-tight"
              >
                Assumo total responsabilidade pelo conteúdo enviado e possíveis
                consequências, incluindo bloqueio de conta e implicações legais.
              </label>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="w-full sm:w-auto"
          >
            {canConfirm ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirmar e Enviar
              </>
            ) : (
              <>
                <MessageSquare className="mr-2 h-4 w-4" />
                Aceite os termos para continuar
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
