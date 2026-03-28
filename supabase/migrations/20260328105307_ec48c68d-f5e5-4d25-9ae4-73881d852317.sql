
-- Migrate vessel_role_certificates from old "Grundläggande säkerhetsutbildning" to standard
UPDATE vessel_role_certificates 
SET certificate_type_id = '7229669a-421a-49a0-90d1-7442f5dad863'
WHERE certificate_type_id = '148e00be-3f7a-4803-9084-a3f7dafc88d2';

-- Migrate user_certificates too
UPDATE user_certificates 
SET certificate_type_id = '7229669a-421a-49a0-90d1-7442f5dad863'
WHERE certificate_type_id = '148e00be-3f7a-4803-9084-a3f7dafc88d2';

-- Now safe to delete the old type
DELETE FROM certificate_types WHERE id = '148e00be-3f7a-4803-9084-a3f7dafc88d2';
