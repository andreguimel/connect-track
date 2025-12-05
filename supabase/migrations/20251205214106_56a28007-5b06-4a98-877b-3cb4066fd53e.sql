-- Create table for Evolution API instances
CREATE TABLE public.evolution_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT max_instances_per_user UNIQUE (user_id, instance_name)
);

-- Enable RLS
ALTER TABLE public.evolution_instances ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own instances" 
ON public.evolution_instances 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own instances" 
ON public.evolution_instances 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own instances" 
ON public.evolution_instances 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own instances" 
ON public.evolution_instances 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_evolution_instances_updated_at
BEFORE UPDATE ON public.evolution_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();