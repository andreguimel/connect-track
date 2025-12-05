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

    const systemPrompt = `Você é um assistente especializado em reescrever mensagens para WhatsApp marketing.

REGRAS ESTRITAS:
1. MANTENHA o sentido EXATO da mensagem original
2. VARIE sinônimos, estrutura de frase e pontuação
3. PRESERVE o tom (formal/informal) da mensagem original
4. MANTENHA todos os emojis existentes (pode trocar por similares)
5. NÃO adicione informações novas
6. NÃO remova informações
7. PRESERVE variáveis como {nome}, {empresa}, etc. EXATAMENTE como estão
8. PRESERVE números, datas, valores, links e URLs EXATAMENTE como estão
9. MANTENHA formatação WhatsApp (*negrito*, _itálico_, ~tachado~)
10. Responda APENAS com a mensagem reescrita, sem explicações

Objetivo: Fazer a mensagem parecer escrita manualmente por uma pessoa diferente.`;

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
          { role: 'user', content: `Reescreva esta mensagem mantendo o mesmo significado:\n\n${message}` }
        ],
        max_tokens: 500,
        temperature: 0.8,
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
