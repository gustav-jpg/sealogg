-- Remove ahrensmedia from Charm Charter org membership
DELETE FROM organization_members 
WHERE user_id = '91c52f98-1bfd-45fc-8590-eb21f08bbdec' 
AND organization_id = 'd142de75-2a6d-4692-a754-44f547b13b3b';

-- Ensure sealogg is added (ignore if already exists)
INSERT INTO organization_members (user_id, organization_id, role) 
VALUES ('e488e459-2370-46c0-b303-7b86b10538d4', 'd142de75-2a6d-4692-a754-44f547b13b3b', 'org_admin')
ON CONFLICT DO NOTHING;