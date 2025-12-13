-- Add message_variations column to campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN message_variations TEXT[] DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.campaigns.message_variations IS 'Array of alternative message variations for anti-ban rotation';