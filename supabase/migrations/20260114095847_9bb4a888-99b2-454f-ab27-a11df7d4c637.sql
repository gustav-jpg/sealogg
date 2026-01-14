-- Add issue_date and is_indefinite columns to vessel_certificates
ALTER TABLE public.vessel_certificates 
ADD COLUMN issue_date DATE,
ADD COLUMN is_indefinite BOOLEAN NOT NULL DEFAULT false;

-- Update expiry_date to be nullable for indefinite certificates
ALTER TABLE public.vessel_certificates 
ALTER COLUMN expiry_date DROP NOT NULL;