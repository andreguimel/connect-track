-- Add media fields to message_templates table
ALTER TABLE public.message_templates 
ADD COLUMN media_url text,
ADD COLUMN media_type text;