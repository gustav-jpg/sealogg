-- Create booking_settings rows for any orgs that already have the bookings module but no settings
INSERT INTO public.booking_settings (organization_id, public_slug, company_name)
SELECT DISTINCT of.organization_id,
  lower(regexp_replace(coalesce(o.name, 'org-' || substr(of.organization_id::text, 1, 8)), '[^a-zA-Z0-9]+', '-', 'g')),
  o.name
FROM public.organization_features of
JOIN public.organizations o ON o.id = of.organization_id
LEFT JOIN public.booking_settings bs ON bs.organization_id = of.organization_id
WHERE of.module = 'bookings'::app_module
  AND of.is_active = true
  AND bs.id IS NULL
ON CONFLICT (organization_id) DO NOTHING;

-- Ensure unique slug if collision, append short suffix
UPDATE public.booking_settings bs1
SET public_slug = bs1.public_slug || '-' || substr(bs1.organization_id::text, 1, 6)
WHERE EXISTS (
  SELECT 1 FROM public.booking_settings bs2
  WHERE bs2.public_slug = bs1.public_slug AND bs2.id <> bs1.id
);