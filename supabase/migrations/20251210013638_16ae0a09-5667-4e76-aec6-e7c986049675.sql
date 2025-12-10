-- Add integration_type column to evolution_instances
ALTER TABLE evolution_instances 
ADD COLUMN integration_type TEXT NOT NULL DEFAULT 'WHATSAPP-BAILEYS';

-- Add comment explaining the column
COMMENT ON COLUMN evolution_instances.integration_type IS 'Type of WhatsApp integration: WHATSAPP-BAILEYS (normal) or WHATSAPP-BUSINESS-BAILEYS (business app)';