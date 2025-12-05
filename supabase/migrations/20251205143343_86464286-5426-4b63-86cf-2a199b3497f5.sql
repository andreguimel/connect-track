-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contact_groups table
CREATE TABLE public.contact_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'bg-blue-500',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contacts table
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  group_id UUID REFERENCES public.contact_groups(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, phone)
);

-- Create message_templates table
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
  stats JSONB NOT NULL DEFAULT '{"total": 0, "pending": 0, "sent": 0, "delivered": 0, "failed": 0}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create campaign_contacts table
CREATE TABLE public.campaign_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'delivered', 'failed')),
  error TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(campaign_id, contact_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for contact_groups
CREATE POLICY "Users can view own groups" ON public.contact_groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own groups" ON public.contact_groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own groups" ON public.contact_groups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own groups" ON public.contact_groups FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for contacts
CREATE POLICY "Users can view own contacts" ON public.contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own contacts" ON public.contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contacts" ON public.contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contacts" ON public.contacts FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for message_templates
CREATE POLICY "Users can view own templates" ON public.message_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own templates" ON public.message_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON public.message_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON public.message_templates FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for campaigns
CREATE POLICY "Users can view own campaigns" ON public.campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own campaigns" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own campaigns" ON public.campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own campaigns" ON public.campaigns FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for campaign_contacts (through campaign ownership)
CREATE POLICY "Users can view own campaign contacts" ON public.campaign_contacts 
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid()));
CREATE POLICY "Users can create own campaign contacts" ON public.campaign_contacts 
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid()));
CREATE POLICY "Users can update own campaign contacts" ON public.campaign_contacts 
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete own campaign contacts" ON public.campaign_contacts 
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid()));

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$;

-- Trigger for auto-creating profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();