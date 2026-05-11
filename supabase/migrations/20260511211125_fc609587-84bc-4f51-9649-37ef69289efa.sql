-- Uppdatera anteckningar på befintliga 2025-05-31-poster
UPDATE public.control_point_records SET notes = 'U.A' WHERE id = '8525c2b8-e578-4ac3-9239-e9908716661f';
UPDATE public.control_point_records SET notes = 'U.A' WHERE id = '7d42b94c-ad1c-4940-8f75-f8b34bbe4e39';
UPDATE public.control_point_records SET notes = 'U.A' WHERE id = '99fdc54b-493d-4721-a49f-71bde902d1a3';
UPDATE public.control_point_records SET notes = 'Rent & snyggt' WHERE id = '6e17389f-b7f7-443f-9eb0-4cbdcfe77916';
UPDATE public.control_point_records SET notes = 'Lättare gelcoatsprickor' WHERE id = '30a19db6-9f28-4427-9433-044f33bd0411';
UPDATE public.control_point_records SET notes = 'Lättare gelcoatsprickor' WHERE id = '7075a469-ea84-42fd-bc77-285752b99878';
UPDATE public.control_point_records SET notes = 'U.A, Sluter tätt' WHERE id = 'e255845d-e033-4be1-bef4-40e4c98a8c56';
UPDATE public.control_point_records SET notes = 'U.A. Sluter tätt' WHERE id = '43b0f106-c424-4910-b58a-cf2fc69e23f9';

-- Lägg till motsvarande poster för 2025 (samma användare som genomförde 2026-posterna)
INSERT INTO public.control_point_records (control_point_id, vessel_id, performed_by, performed_at, notes, created_at)
VALUES
  ('cb987170-9cfa-4ecb-95ef-67e8c784fe2b', '56f90f68-0fe2-4662-97c5-b2791a0b926d', 'e488e459-2370-46c0-b303-7b86b10538d4', '2025-04-02', 'Fungerar U.A', '2025-04-02 12:00+02'),
  ('9a916ea8-3d13-46df-bd7a-84133d8c7804', '56f90f68-0fe2-4662-97c5-b2791a0b926d', 'e488e459-2370-46c0-b303-7b86b10538d4', '2025-04-02', 'Testat U.A', '2025-04-02 12:00+02'),
  ('de150319-b590-4469-8db8-19c90239bff3', '56f90f68-0fe2-4662-97c5-b2791a0b926d', 'e488e459-2370-46c0-b303-7b86b10538d4', '2025-04-02', 'Fungerar U.A', '2025-04-02 12:00+02'),
  ('5ece3c82-8d30-48a7-8830-c1064c5d77bd', '56f90f68-0fe2-4662-97c5-b2791a0b926d', 'e488e459-2370-46c0-b303-7b86b10538d4', '2025-03-20', 'Utförd enligt bilaga', '2025-03-20 12:00+01'),
  ('d50cc688-6558-4181-899d-fd774541fca2', '56f90f68-0fe2-4662-97c5-b2791a0b926d', 'e488e459-2370-46c0-b303-7b86b10538d4', '2025-03-20', 'Kontrollerad UA', '2025-03-20 12:00+01');