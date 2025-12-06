import { useState } from 'react';
import { Crown, Loader2, Clock, Lock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function SubscriptionBanner() {
  const { subscription, isTrialActive, isSubscriptionActive, hasAccess, getRemainingTrialDays, getLimits, campaignCount } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (!subscription || isDismissed) return null;

  const handleSubscribe = async () => {
    if (!user?.email) {
      toast({
        title: "Erro",
        description: "Usuário não encontrado",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mercadopago-checkout', {
        body: {
          userId: user.id,
          userEmail: user.email,
        },
      });

      if (error) throw error;

      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Erro ao iniciar pagamento",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const limits = getLimits();
  const remainingDays = getRemainingTrialDays();
  const remainingCampaigns = limits.maxCampaigns - campaignCount;

  // Full subscriber - show minimal or no banner
  if (isSubscriptionActive()) {
    return (
      <div className="relative rounded-xl border border-success/30 bg-success/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/20">
              <Crown className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-success">Assinatura Ativa</h3>
              <p className="text-sm text-muted-foreground">
                Acesso completo a todas as funcionalidades
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsDismissed(true)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Trial expired - show urgent upgrade banner
  if (!hasAccess()) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20">
              <Lock className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-destructive">Período de Teste Encerrado</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Seu período de teste gratuito terminou. Assine agora para continuar usando o ZapMassa.
              </p>
            </div>
          </div>
          <Button 
            onClick={handleSubscribe} 
            disabled={isLoading}
            className="shrink-0 bg-primary hover:bg-primary/90"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Crown className="mr-2 h-4 w-4" />
                Assinar por R$ 149,90/mês
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Trial active - show trial info banner
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/20">
            <Clock className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h3 className="font-semibold text-warning">
              Período de Teste - {remainingDays} {remainingDays === 1 ? 'dia restante' : 'dias restantes'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Limitações: máx. {limits.maxCampaigns} campanhas ({remainingCampaigns} restantes) • 
              máx. {limits.maxContactsPerCampaign} contatos por campanha • 
              sem importação do WhatsApp
            </p>
          </div>
        </div>
        <Button 
          onClick={handleSubscribe} 
          disabled={isLoading}
          variant="outline"
          className="shrink-0 border-warning text-warning hover:bg-warning/10"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Crown className="mr-2 h-4 w-4" />
              Assinar R$ 149,90/mês
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
