
-- Fix remaining: Skärgårdsrederiet "Grundläggande säkerhetsutbildning" -> standard name
UPDATE user_certificates SET certificate_type_id = new_ct.id
FROM certificate_types old_ct, certificate_types new_ct
WHERE user_certificates.certificate_type_id = old_ct.id
  AND old_ct.name = 'Grundläggande säkerhetsutbildning'
  AND new_ct.name = 'Grundläggande säkerhetsutbildning (Basic Safety)'
  AND new_ct.organization_id = old_ct.organization_id;

-- Also handle the trimmed variant with trailing space
UPDATE user_certificates SET certificate_type_id = new_ct.id
FROM certificate_types old_ct, certificate_types new_ct
WHERE user_certificates.certificate_type_id = old_ct.id
  AND old_ct.name LIKE 'Grundläggande säkerhetsutbildning'
  AND old_ct.name != 'Grundläggande säkerhetsutbildning (Basic Safety)'
  AND new_ct.name = 'Grundläggande säkerhetsutbildning (Basic Safety)'
  AND new_ct.organization_id = old_ct.organization_id;

-- Now delete the remaining old duplicates
DELETE FROM certificate_types 
WHERE name = 'Grundläggande säkerhetsutbildning'
  AND id NOT IN (SELECT certificate_type_id FROM user_certificates WHERE certificate_type_id IS NOT NULL);
