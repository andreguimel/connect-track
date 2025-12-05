-- Add scheduling fields to campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN scheduled_at timestamp with time zone,
ADD COLUMN media_url text,
ADD COLUMN media_type text;

-- Create storage bucket for campaign media
INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-media', 'campaign-media', true);

-- Storage policies for campaign media
CREATE POLICY "Users can upload own campaign media"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'campaign-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own campaign media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'campaign-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own campaign media"
ON storage.objects
FOR DELETE
USING (bucket_id = 'campaign-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public can view campaign media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'campaign-media');