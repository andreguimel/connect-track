-- Create table for WhatsApp Business API connections
CREATE TABLE public.whatsapp_business_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  business_account_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_business_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own business accounts"
ON public.whatsapp_business_accounts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own business accounts"
ON public.whatsapp_business_accounts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own business accounts"
ON public.whatsapp_business_accounts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own business accounts"
ON public.whatsapp_business_accounts
FOR DELETE
USING (auth.uid() = user_id);

-- Create table for WhatsApp Business templates (approved by Meta)
CREATE TABLE public.whatsapp_business_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.whatsapp_business_accounts(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_id TEXT,
  language TEXT NOT NULL DEFAULT 'pt_BR',
  category TEXT NOT NULL DEFAULT 'MARKETING',
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_business_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for templates
CREATE POLICY "Users can view own templates"
ON public.whatsapp_business_templates
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own templates"
ON public.whatsapp_business_templates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
ON public.whatsapp_business_templates
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
ON public.whatsapp_business_templates
FOR DELETE
USING (auth.uid() = user_id);

-- Add premium plan field to subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'standard';

-- Create trigger for updated_at
CREATE TRIGGER update_whatsapp_business_accounts_updated_at
BEFORE UPDATE ON public.whatsapp_business_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_business_templates_updated_at
BEFORE UPDATE ON public.whatsapp_business_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();