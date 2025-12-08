import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Zap, Crown, MessageSquare, Users, Shield, Bot, Smartphone, ArrowRight, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import WhatsAppMockup from '@/components/landing/WhatsAppMockup';

const features = [
  {
    name: 'Envio de mensagens em massa',
    standard: true,
    premium: true,
  },
  {
    name: 'Contatos ilimitados',
    standard: true,
    premium: true,
  },
  {
    name: 'Campanhas ilimitadas',
    standard: true,
    premium: true,
  },
  {
    name: 'Importação de contatos (CSV/WhatsApp)',
    standard: true,
    premium: true,
  },
  {
    name: 'Templates de mensagens',
    standard: true,
    premium: true,
  },
  {
    name: 'Medidas anti-ban (não garante proteção)',
    standard: true,
    premium: true,
  },
  {
    name: 'Variação de mensagens por IA',
    standard: true,
    premium: true,
  },
  {
    name: 'Métricas em tempo real',
    standard: true,
    premium: true,
  },
  {
    name: 'Exportação de relatórios',
    standard: true,
    premium: true,
  },
  {
    name: 'Até 3 conexões WhatsApp',
    standard: true,
    premium: true,
  },
  {
    name: 'API Oficial do WhatsApp Business',
    standard: false,
    premium: true,
  },
  {
    name: 'Botões interativos nas mensagens',
    standard: false,
    premium: true,
  },
  {
    name: 'Listas de opções',
    standard: false,
    premium: true,
  },
  {
    name: 'Templates aprovados pelo WhatsApp',
    standard: false,
    premium: true,
  },
  {
    name: 'Garantia contra banimento',
    standard: false,
    premium: true,
  },
  {
    name: 'Maior limite de mensagens/dia',
    standard: false,
    premium: true,
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSelectPlan = async (planType: 'standard' | 'premium') => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setLoadingPlan(planType);

    try {
      const { data, error } = await supabase.functions.invoke('mercadopago-checkout', {
        body: {
          userId: user.id,
          userEmail: user.email,
          planType,
        },
      });

      if (error) throw error;

      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('URL de checkout não retornada');
      }
    } catch (error: any) {
      console.error('Erro ao criar checkout:', error);
      toast.error(error.message || 'Erro ao processar pagamento');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold">ZapMassa</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <Button onClick={() => navigate('/')}>
                Acessar App
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/auth')}>
                  Entrar
                </Button>
                <Button onClick={() => navigate('/auth')}>
                  Começar Grátis
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-12">
          <Badge className="mb-4" variant="secondary">
            <Smartphone className="h-3 w-3 mr-1" />
            WhatsApp Marketing
          </Badge>
          <h1 className="font-display text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Envie mensagens em massa<br />pelo WhatsApp
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            A plataforma mais completa para disparos de WhatsApp com proteção anti-ban, 
            variação por IA e métricas em tempo real.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap mb-12">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-green-500" />
              3 dias grátis
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-green-500" />
              Sem cartão de crédito
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-green-500" />
              Cancele quando quiser
            </div>
          </div>
        </div>
        
        {/* WhatsApp Mockup */}
        <div className="pb-8">
          <WhatsAppMockup />
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-6 mb-16">
          <div className="text-center p-6 rounded-xl bg-card border">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Disparos em Massa</h3>
            <p className="text-sm text-muted-foreground">Envie para centenas de contatos com um clique</p>
          </div>
          <div className="text-center p-6 rounded-xl bg-card border">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Anti-Ban*</h3>
            <p className="text-sm text-muted-foreground">Medidas de proteção para reduzir riscos</p>
          </div>
          <div className="text-center p-6 rounded-xl bg-card border">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">IA Integrada</h3>
            <p className="text-sm text-muted-foreground">Variação automática de mensagens</p>
          </div>
          <div className="text-center p-6 rounded-xl bg-card border">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Gestão de Contatos</h3>
            <p className="text-sm text-muted-foreground">Organize em categorias e grupos</p>
          </div>
        </div>
      </section>

      {/* Warning Section */}
      <section className="container mx-auto px-4 py-8">
        <Alert className="max-w-4xl mx-auto border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <AlertTitle className="text-amber-600 dark:text-amber-400">
            Aviso Importante sobre Banimentos
          </AlertTitle>
          <AlertDescription className="text-muted-foreground mt-2 space-y-2">
            <p>
              <strong>O plano Standard utiliza conexão via WhatsApp Web</strong>, que não é oficialmente 
              suportada pelo WhatsApp para envios em massa. Embora nossa proteção anti-ban reduza 
              significativamente os riscos (delays aleatórios, limites diários, variação de mensagens), 
              <strong className="text-foreground"> não podemos garantir que seu número não será banido</strong>.
            </p>
            <p>
              O WhatsApp pode detectar e bloquear números a qualquer momento, independente das medidas 
              de proteção utilizadas. <strong className="text-foreground">Use por sua conta e risco.</strong>
            </p>
            <p className="pt-2 text-sm">
              💡 <strong>Dica:</strong> Para <strong className="text-primary">zero risco de banimento</strong>, 
              considere o <strong className="text-primary">Plano Premium</strong> com a API Oficial do WhatsApp Business, 
              que é a única forma aprovada pelo WhatsApp para envios comerciais.
            </p>
          </AlertDescription>
        </Alert>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-4 py-12" id="planos">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Escolha seu plano
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Comece com 3 dias grátis. Escolha o plano ideal para o seu negócio.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Standard Plan */}
          <Card className="relative">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Standard
              </CardTitle>
              <CardDescription>
                Para quem está começando com WhatsApp Marketing
              </CardDescription>
              <div className="pt-4">
                <span className="text-4xl font-bold">R$ 149,90</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {features.slice(0, 10).map((feature) => (
                <div key={feature.name} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  <span>{feature.name}</span>
                </div>
              ))}
              {features.slice(10).map((feature) => (
                <div key={feature.name} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <X className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  <span>{feature.name}</span>
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => handleSelectPlan('standard')}
                disabled={loadingPlan !== null}
              >
                {loadingPlan === 'standard' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Começar com Standard'
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Premium Plan */}
          <Card className="relative border-primary shadow-lg shadow-primary/10">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground">
                <Crown className="h-3 w-3 mr-1" />
                Recomendado
              </Badge>
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Premium
              </CardTitle>
              <CardDescription>
                Para quem quer o máximo de recursos e segurança
              </CardDescription>
              <div className="pt-4">
                <span className="text-4xl font-bold">R$ 249,90</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {features.map((feature) => (
                <div key={feature.name} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  <span>{feature.name}</span>
                  {!feature.standard && feature.premium && (
                    <Badge variant="secondary" className="text-xs ml-auto">
                      Premium
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full"
                onClick={() => handleSelectPlan('premium')}
                disabled={loadingPlan !== null}
              >
                {loadingPlan === 'premium' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Crown className="h-4 w-4 mr-2" />
                    Começar com Premium
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* API Oficial Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <Badge className="mb-4 bg-primary/20 text-primary border-0">
                <Crown className="h-3 w-3 mr-1" />
                Exclusivo Premium
              </Badge>
              <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">
                API Oficial do WhatsApp Business
              </h2>
              <p className="text-muted-foreground mb-6">
                Com o plano Premium, você tem acesso à API Oficial do WhatsApp, 
                permitindo enviar mensagens com botões interativos, listas de opções 
                e templates aprovados. Zero risco de banimento!
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Botões clicáveis nas mensagens</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Listas de opções interativas</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Templates pré-aprovados</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Sem limite de mensagens</span>
                </div>
              </div>
            </div>
            <div className="bg-background rounded-xl border p-6 shadow-lg">
              <div className="bg-[#075E54] text-white rounded-t-lg px-4 py-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Sua Empresa</p>
                  <p className="text-xs text-white/70">online</p>
                </div>
              </div>
              <div className="bg-[#ECE5DD] p-4 space-y-3">
                <div className="bg-white rounded-lg p-3 shadow-sm max-w-[280px]">
                  <p className="text-sm text-gray-800 mb-3">
                    Olá! 👋 Escolha uma opção:
                  </p>
                  <div className="space-y-2">
                    <button className="w-full py-2 px-3 border border-[#25D366] text-[#25D366] rounded-lg text-sm font-medium hover:bg-[#25D366]/5 transition-colors">
                      📦 Ver Produtos
                    </button>
                    <button className="w-full py-2 px-3 border border-[#25D366] text-[#25D366] rounded-lg text-sm font-medium hover:bg-[#25D366]/5 transition-colors">
                      💬 Falar com Atendente
                    </button>
                    <button className="w-full py-2 px-3 border border-[#25D366] text-[#25D366] rounded-lg text-sm font-medium hover:bg-[#25D366]/5 transition-colors">
                      📍 Localização
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 text-right mt-2">14:32 ✓✓</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">
          Pronto para começar?
        </h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          Teste grátis por 3 dias. Sem cartão de crédito. Cancele quando quiser.
        </p>
        <Button size="lg" onClick={() => navigate('/auth')}>
          Criar conta grátis
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display font-bold">ZapMassa</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} ZapMassa. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
