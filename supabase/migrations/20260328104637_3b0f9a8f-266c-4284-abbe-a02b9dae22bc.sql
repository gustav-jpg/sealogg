
-- Update the seed function with the correct certificate types
CREATE OR REPLACE FUNCTION public.seed_default_certificate_types(org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO certificate_types (organization_id, name, description) VALUES
    -- Behörighetsbevis (CoC)
    (org_id, 'Fartygsbefäl klass VIII', 'Behörighetsbevis (CoC)'),
    (org_id, 'Fartygsbefäl klass VII', 'Behörighetsbevis (CoC)'),
    (org_id, 'Fartygsbefäl klass VI', 'Behörighetsbevis (CoC)'),
    (org_id, 'Maskinbefäl klass VIII', 'Behörighetsbevis (CoC)'),
    -- Behörighetsintyg (Ratings)
    (org_id, 'Lättmatros', 'Behörighetsintyg (Rating)'),
    (org_id, 'Matros', 'Behörighetsintyg (Rating)'),
    -- Säkerhetscertifikat – Grund
    (org_id, 'Grundläggande säkerhetsutbildning (Basic Safety)', 'Grundläggande säkerhetscertifikat'),
    -- Säkerhetscertifikat – Avancerade
    (org_id, 'Avancerad brandbekämpning', 'Avancerat säkerhetscertifikat'),
    (org_id, 'Räddningsfarkoster och beredskapsbåtar (PSCRB)', 'Avancerat säkerhetscertifikat'),
    -- Specialbehörigheter (passagerarfartyg)
    (org_id, 'Krishantering', 'Specialbehörighet passagerarfartyg'),
    -- Medicinska certifikat
    (org_id, 'Läkarintyg för sjöfolk', 'Medicinskt certifikat'),
    (org_id, 'Medical First Aid', 'Medicinskt certifikat'),
    -- Radiocertifikat
    (org_id, 'SRC (Short Range Certificate)', 'Radiocertifikat'),
    (org_id, 'ROC (Restricted Operator Certificate)', 'Radiocertifikat')
  ON CONFLICT DO NOTHING;
END;
$$;

-- Clean up old seeded types and replace with new ones for existing orgs
-- Remove old types that are no longer in the standard list
DELETE FROM certificate_types WHERE name IN (
  'Sjöbefälsklass VII',
  'Sjöfartsbok',
  'Begränsad radiooperatör (SRC)',
  'Intyg om specialbehörighet',
  'Lotsbehörighet',
  'Sjukvårdsintyg',
  'Brandskyddsintyg',
  'Första hjälpen-intyg'
) AND id NOT IN (
  SELECT DISTINCT confirmed_type_id FROM pending_certificates WHERE confirmed_type_id IS NOT NULL
  UNION
  SELECT DISTINCT certificate_type_id FROM user_certificates WHERE certificate_type_id IS NOT NULL
);

-- Seed new types for all existing organizations
INSERT INTO certificate_types (organization_id, name, description)
SELECT o.id, t.name, t.description
FROM organizations o
CROSS JOIN (VALUES
  ('Fartygsbefäl klass VIII', 'Behörighetsbevis (CoC)'),
  ('Fartygsbefäl klass VII', 'Behörighetsbevis (CoC)'),
  ('Fartygsbefäl klass VI', 'Behörighetsbevis (CoC)'),
  ('Maskinbefäl klass VIII', 'Behörighetsbevis (CoC)'),
  ('Lättmatros', 'Behörighetsintyg (Rating)'),
  ('Matros', 'Behörighetsintyg (Rating)'),
  ('Grundläggande säkerhetsutbildning (Basic Safety)', 'Grundläggande säkerhetscertifikat'),
  ('Avancerad brandbekämpning', 'Avancerat säkerhetscertifikat'),
  ('Räddningsfarkoster och beredskapsbåtar (PSCRB)', 'Avancerat säkerhetscertifikat'),
  ('Krishantering', 'Specialbehörighet passagerarfartyg'),
  ('Läkarintyg för sjöfolk', 'Medicinskt certifikat'),
  ('Medical First Aid', 'Medicinskt certifikat'),
  ('SRC (Short Range Certificate)', 'Radiocertifikat'),
  ('ROC (Restricted Operator Certificate)', 'Radiocertifikat')
) AS t(name, description)
WHERE NOT EXISTS (
  SELECT 1 FROM certificate_types ct 
  WHERE ct.organization_id = o.id AND ct.name = t.name
);
