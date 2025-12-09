import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY não está configurada');
    }

    const { message, context } = await req.json();

    if (!message) {
      throw new Error('Mensagem não fornecida');
    }

    console.log('Variando mensagem:', message.substring(0, 50) + '...');

const systemPrompt = `Você é um especialista em reescrever mensagens de forma SUTIL para evitar detecção de mensagens duplicadas.

OBJETIVO: Fazer pequenas alterações na estrutura sem mudar o conteúdo ou adicionar elementos novos.

TÉCNICAS DE VARIAÇÃO PERMITIDAS:
- Mude a ORDEM de algumas palavras ou frases
- Use SINÔNIMOS simples (palavras diferentes com mesmo significado)
- Varie conectivos: "e", "também", "além disso", "ainda"
- Altere levemente a estrutura das frases
- Mude saudações simples: "Oi", "Olá", "Olá!" (se existir)
- Adicione ou remova palavras como: "então", "né", "viu", "tá"

PROIBIDO - NÃO FAÇA:
- NÃO adicione emojis ou ícones que não existiam na mensagem original
- NÃO remova emojis que existiam na mensagem original
- NÃO mude emojis por outros diferentes
- NÃO adicione saudações se não tinha
- NÃO adicione despedidas se não tinha
- NÃO mude o tom da mensagem (formal/informal)
- NÃO adicione informações novas

REGRAS OBRIGATÓRIAS:
1. PRESERVE exatamente os mesmos emojis nas mesmas posições (ou muito próximas)
2. PRESERVE variáveis {nome}, {empresa}, etc. EXATAMENTE como estão
3. PRESERVE números, datas, valores, links e URLs sem alteração
4. PRESERVE formatação WhatsApp (*negrito*, _itálico_, ~tachado~)
5. Responda APENAS com a mensagem reescrita, nada mais

A mensagem deve parecer quase igual, apenas com pequenas variações sutis.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Reescreva esta mensagem com variações SUTIS. NÃO adicione emojis, ícones ou elementos novos. Apenas pequenas alterações na estrutura:\n\n${message}` }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const variedMessage = data.choices[0].message.content.trim();

    console.log('Mensagem variada com sucesso');

    return new Response(JSON.stringify({ 
      success: true,
      originalMessage: message,
      variedMessage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in variate-message function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage,
      variedMessage: null
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
