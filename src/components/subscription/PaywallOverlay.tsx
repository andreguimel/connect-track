import { useState } from 'react';
import { Crown, Loader2, Lock, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function PaywallOverlay() {
  const { hasAccess } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  if (hasAccess()) return null;

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

  const features = [
    'Campanhas ilimitadas',
    'Contatos ilimitados por campanha',
    'Importação de contatos do WhatsApp',
    'Exportação de contatos',
    'Suporte prioritário',
    'Múltiplas conexões WhatsApp',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl border bg-card p-8 shadow-2xl">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-8 w-8 text-primary" />
          </div>
        </div>

        <h2 className="mb-2 text-center text-2xl font-bold">
          Seu Período de Teste Expirou
        </h2>
        <p className="mb-6 text-center text-muted-foreground">
          Assine o ZapMassa para continuar enviando mensagens em massa via WhatsApp
        </p>

        <div className="mb-6 rounded-xl bg-primary/5 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-semibold">Plano Completo</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold">R$ 149,90</span>
              <span className="text-muted-foreground">/mês</span>
            </div>
          </div>

          <ul className="space-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <Check className="h-4 w-4 text-success" />
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <Button 
          onClick={handleSubscribe} 
          disabled={isLoading}
          className="w-full"
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
              Assinar Agora
            </>
          )}
        </Button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Pagamento seguro via MercadoPago. Cancele quando quiser.
        </p>
      </div>
    </div>
  );
}
