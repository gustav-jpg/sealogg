
-- Migrate user_certificates from old duplicate types to new standard types
-- We need to update certificate_type_id for each org separately since each org has its own standard type IDs

-- Step 1: Create a mapping table of old->new for each organization
-- We'll do this by matching old names to new standard names within the same org

-- Update user_certificates: Basic safety -> Grundläggande säkerhetsutbildning (Basic Safety)
UPDATE user_certificates SET certificate_type_id = new_ct.id
FROM certificate_types old_ct, certificate_types new_ct
WHERE user_certificates.certificate_type_id = old_ct.id
  AND old_ct.name IN ('Basic safety', 'Grundläggande säkerhetsutbildning')
  AND new_ct.name = 'Grundläggande säkerhetsutbildning (Basic Safety)'
  AND new_ct.organization_id = old_ct.organization_id;

-- Fartygsbefäl klass 7 / FB 7 -> Fartygsbefäl klass VII
UPDATE user_certificates SET certificate_type_id = new_ct.id
FROM certificate_types old_ct, certificate_types new_ct
WHERE user_certificates.certificate_type_id = old_ct.id
  AND old_ct.name IN ('Fartygsbefäl klass 7', 'FB 7')
  AND new_ct.name = 'Fartygsbefäl klass VII'
  AND new_ct.organization_id = old_ct.organization_id;

-- Fartygsbefäl klass 6 / FB 6 -> Fartygsbefäl klass VI
UPDATE user_certificates SET certificate_type_id = new_ct.id
FROM certificate_types old_ct, certificate_types new_ct
WHERE user_certificates.certificate_type_id = old_ct.id
  AND old_ct.name IN ('Fartygsbefäl klass 6', 'FB 6')
  AND new_ct.name = 'Fartygsbefäl klass VI'
  AND new_ct.organization_id = old_ct.organization_id;

-- Fartygsbefäl Klass 8 -> Fartygsbefäl klass VIII
UPDATE user_certificates SET certificate_type_id = new_ct.id
FROM certificate_types old_ct, certificate_types new_ct
WHERE user_certificates.certificate_type_id = old_ct.id
  AND old_ct.name = 'Fartygsbefäl Klass 8'
  AND new_ct.name = 'Fartygsbefäl klass VIII'
  AND new_ct.organization_id = old_ct.organization_id;

-- Maskinbefälsexamen 8 / Maskinbefäl klass 8 / Maskinbefäl Klass 8 / Maskinbefäl (generisk) -> Maskinbefäl klass VIII
UPDATE user_certificates SET certificate_type_id = new_ct.id
FROM certificate_types old_ct, certificate_types new_ct
WHERE user_certificates.certificate_type_id = old_ct.id
  AND old_ct.name IN ('Maskinbefälsexamen 8', 'Maskinbefäl klass 8', 'Maskinbefäl Klass 8', 'Maskinbefäl')
  AND new_ct.name = 'Maskinbefäl klass VIII'
  AND new_ct.organization_id = old_ct.organization_id;

-- Läkarintyg -> Läkarintyg för sjöfolk
UPDATE user_certificates SET certificate_type_id = new_ct.id
FROM certificate_types old_ct, certificate_types new_ct
WHERE user_certificates.certificate_type_id = old_ct.id
  AND old_ct.name = 'Läkarintyg'
  AND new_ct.name = 'Läkarintyg för sjöfolk'
  AND new_ct.organization_id = old_ct.organization_id;

-- Matrosbehörighet -> Matros
UPDATE user_certificates SET certificate_type_id = new_ct.id
FROM certificate_types old_ct, certificate_types new_ct
WHERE user_certificates.certificate_type_id = old_ct.id
  AND old_ct.name IN ('Matrosbehörighet', 'Matrosbehörighet ')
  AND new_ct.name = 'Matros'
  AND new_ct.organization_id = old_ct.organization_id;

-- Step 2: Delete old duplicate certificate_types that are no longer referenced
DELETE FROM certificate_types WHERE name IN (
  'Basic safety',
  'Grundläggande säkerhetsutbildning',
  'Fartygsbefäl klass 7',
  'Fartygsbefäl klass 6',
  'Fartygsbefäl Klass 8',
  'Maskinbefälsexamen 8',
  'Maskinbefäl klass 8',
  'Maskinbefäl Klass 8',
  'Maskinbefäl',
  'Läkarintyg',
  'Matrosbehörighet',
  'Matrosbehörighet ',
  'FB 6',
  'FB 7'
) AND id NOT IN (
  SELECT certificate_type_id FROM user_certificates WHERE certificate_type_id IS NOT NULL
);
