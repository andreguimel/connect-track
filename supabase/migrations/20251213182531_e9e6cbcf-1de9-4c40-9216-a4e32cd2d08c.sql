-- Adicionar coluna para armazenar qual variação de mensagem foi usada para cada contato
ALTER TABLE public.campaign_contacts 
ADD COLUMN IF NOT EXISTS variation_index integer DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.campaign_contacts.variation_index IS 'Índice da variação de mensagem usada (0 = mensagem principal, 1+ = variações)';