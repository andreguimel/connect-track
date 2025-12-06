-- Remove the foreign key constraint on contact_id to allow groups to use random UUIDs
ALTER TABLE public.campaign_contacts 
DROP CONSTRAINT campaign_contacts_contact_id_fkey;

-- Also drop the unique constraint that prevents multiple entries with same campaign/contact
-- since groups might need different handling
ALTER TABLE public.campaign_contacts
DROP CONSTRAINT campaign_contacts_campaign_id_contact_id_key;

-- Add a new unique constraint that includes group_jid for proper uniqueness
ALTER TABLE public.campaign_contacts
ADD CONSTRAINT campaign_contacts_unique_recipient 
UNIQUE (campaign_id, contact_id, group_jid);