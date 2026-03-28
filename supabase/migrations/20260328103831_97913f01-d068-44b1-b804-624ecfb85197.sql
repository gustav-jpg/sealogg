
-- Function to seed default certificate types for an organization
CREATE OR REPLACE FUNCTION public.seed_default_certificate_types(org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO certificate_types (organization_id, name, description) VALUES
    (org_id, 'Sjöbefälsklass VII', 'Behörighet för fartygsbefäl klass VII'),
    (org_id, 'Fartygsbefäl klass VIII', 'Behörighet för fartygsbefäl klass VIII'),
    (org_id, 'Maskinbefäl', 'Behörighet för maskinbefäl'),
    (org_id, 'Sjöfartsbok', 'Sjömans sjöfartsbok'),
    (org_id, 'Grundläggande säkerhetsutbildning', 'Basic Safety Training (BST)'),
    (org_id, 'Begränsad radiooperatör (SRC)', 'Short Range Certificate'),
    (org_id, 'Intyg om specialbehörighet', 'Specialbehörighetsintyg'),
    (org_id, 'Lotsbehörighet', 'Intyg om lotsbehörighet'),
    (org_id, 'Sjukvårdsintyg', 'Läkarintyg för sjötjänst'),
    (org_id, 'Brandskyddsintyg', 'Intyg om brandskyddsutbildning'),
    (org_id, 'Första hjälpen-intyg', 'Intyg om utbildning i första hjälpen')
  ON CONFLICT DO NOTHING;
END;
$$;

-- Trigger function to auto-seed on new organization
CREATE OR REPLACE FUNCTION public.handle_new_organization_certificates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM seed_default_certificate_types(NEW.id);
  RETURN NEW;
END;
$$;

-- Trigger on organizations table
DROP TRIGGER IF EXISTS on_organization_created_seed_certs ON public.organizations;
CREATE TRIGGER on_organization_created_seed_certs
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_organization_certificates();

-- Seed existing organizations that have no certificate types yet
INSERT INTO certificate_types (organization_id, name, description)
SELECT o.id, t.name, t.description
FROM organizations o
CROSS JOIN (VALUES
  ('Sjöbefälsklass VII', 'Behörighet för fartygsbefäl klass VII'),
  ('Fartygsbefäl klass VIII', 'Behörighet för fartygsbefäl klass VIII'),
  ('Maskinbefäl', 'Behörighet för maskinbefäl'),
  ('Sjöfartsbok', 'Sjömans sjöfartsbok'),
  ('Grundläggande säkerhetsutbildning', 'Basic Safety Training (BST)'),
  ('Begränsad radiooperatör (SRC)', 'Short Range Certificate'),
  ('Intyg om specialbehörighet', 'Specialbehörighetsintyg'),
  ('Lotsbehörighet', 'Intyg om lotsbehörighet'),
  ('Sjukvårdsintyg', 'Läkarintyg för sjötjänst'),
  ('Brandskyddsintyg', 'Intyg om brandskyddsutbildning'),
  ('Första hjälpen-intyg', 'Intyg om utbildning i första hjälpen')
) AS t(name, description)
WHERE NOT EXISTS (
  SELECT 1 FROM certificate_types ct 
  WHERE ct.organization_id = o.id AND ct.name = t.name
);
