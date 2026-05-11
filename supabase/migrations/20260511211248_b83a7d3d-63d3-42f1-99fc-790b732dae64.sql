UPDATE public.control_point_records SET notes = 'OK, fungerar som det ska'
  WHERE vessel_id='56f90f68-0fe2-4662-97c5-b2791a0b926d' AND performed_at='2025-04-02'
    AND control_point_id='cb987170-9cfa-4ecb-95ef-67e8c784fe2b';
UPDATE public.control_point_records SET notes = 'Test utförd, larm löste ut korrekt'
  WHERE vessel_id='56f90f68-0fe2-4662-97c5-b2791a0b926d' AND performed_at='2025-04-02'
    AND control_point_id='9a916ea8-3d13-46df-bd7a-84133d8c7804';
UPDATE public.control_point_records SET notes = 'Provkörd, tillräckligt flöde'
  WHERE vessel_id='56f90f68-0fe2-4662-97c5-b2791a0b926d' AND performed_at='2025-04-02'
    AND control_point_id='de150319-b590-4469-8db8-19c90239bff3';
UPDATE public.control_point_records SET notes = 'Inga anmärkningar, mindre påväxt rengjord'
  WHERE vessel_id='56f90f68-0fe2-4662-97c5-b2791a0b926d' AND performed_at='2025-03-20'
    AND control_point_id='5ece3c82-8d30-48a7-8830-c1064c5d77bd';
UPDATE public.control_point_records SET notes = 'Okulärbesiktigad, inga skador'
  WHERE vessel_id='56f90f68-0fe2-4662-97c5-b2791a0b926d' AND performed_at='2025-03-20'
    AND control_point_id='d50cc688-6558-4181-899d-fd774541fca2';