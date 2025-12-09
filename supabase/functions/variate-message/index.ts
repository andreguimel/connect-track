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

const systemPrompt = `Você é um especialista em reescrever mensagens de WhatsApp de forma CRIATIVA e ÚNICA.

OBJETIVO PRINCIPAL: Cada mensagem deve parecer ter sido escrita por uma pessoa completamente diferente. Seja CRIATIVO!

TÉCNICAS DE VARIAÇÃO (use várias combinadas):
- Mude a ORDEM das informações (comece pelo fim, pelo meio, etc.)
- Use SINÔNIMOS diferentes e expressões alternativas
- Varie o ESTILO: mais direto, mais amigável, mais profissional, mais casual
- Altere a ESTRUTURA: frases curtas vs longas, lista vs texto corrido
- Mude saudações: "Oi", "Olá", "E aí", "Fala", "Opa", "Hey", ou comece sem saudação
- Varie despedidas: "Abraço", "Até mais", "Valeu", "Beijos", ou sem despedida
- Adicione ou remova interjeições naturais: "então", "né", "viu", "tá", "enfim"
- Troque emojis por similares ou mude posição deles
- Use pontuação diferente: !, !!, ..., ou sem pontuação extra

REGRAS OBRIGATÓRIAS:
1. PRESERVE o sentido e todas as informações essenciais
2. PRESERVE variáveis {nome}, {empresa}, etc. EXATAMENTE como estão
3. PRESERVE números, datas, valores, links e URLs sem alteração
4. PRESERVE formatação WhatsApp (*negrito*, _itálico_, ~tachado~)
5. Responda APENAS com a mensagem reescrita, nada mais

IMPORTANTE: Cada chamada deve gerar uma versão SIGNIFICATIVAMENTE diferente. Não seja sutil - seja criativo!`;

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
          { role: 'user', content: `Reescreva esta mensagem de forma BEM DIFERENTE, como se outra pessoa tivesse escrito. Seja criativo na estrutura, ordem e estilo:\n\n${message}` }
        ],
        max_tokens: 500,
        temperature: 1.0,
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
