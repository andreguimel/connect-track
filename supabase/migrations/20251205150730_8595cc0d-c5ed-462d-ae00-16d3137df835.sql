-- Enable realtime for campaign_contacts table
ALTER TABLE public.campaign_contacts REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_contacts;

-- Also enable for campaigns table to track status changes
ALTER TABLE public.campaigns REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;