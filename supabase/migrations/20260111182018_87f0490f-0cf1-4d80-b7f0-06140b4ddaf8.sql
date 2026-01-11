-- Drop the global unique constraint on name
ALTER TABLE public.certificate_types DROP CONSTRAINT certificate_types_name_key;

-- Add a composite unique constraint on (organization_id, name) so same name can exist in different orgs
ALTER TABLE public.certificate_types ADD CONSTRAINT certificate_types_org_name_key UNIQUE (organization_id, name);