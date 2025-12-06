-- Create whatsapp_groups table
CREATE TABLE public.whatsapp_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  instance_id UUID NOT NULL REFERENCES public.evolution_instances(id) ON DELETE CASCADE,
  group_jid TEXT NOT NULL,
  name TEXT NOT NULL,
  participants_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, group_jid)
);

-- Enable RLS
ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own groups" ON public.whatsapp_groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own groups" ON public.whatsapp_groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own groups" ON public.whatsapp_groups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own groups" ON public.whatsapp_groups FOR DELETE USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_whatsapp_groups_updated_at
BEFORE UPDATE ON public.whatsapp_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add recipient_type and group_jid to campaign_contacts
ALTER TABLE public.campaign_contacts 
ADD COLUMN recipient_type TEXT NOT NULL DEFAULT 'contact',
ADD COLUMN group_jid TEXT;