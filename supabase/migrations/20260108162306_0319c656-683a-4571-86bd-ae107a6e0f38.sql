-- Remove old unique constraint that prevents same role in different groups
ALTER TABLE public.vessel_crew_requirements 
DROP CONSTRAINT vessel_crew_requirements_vessel_id_role_key;

-- Add new unique constraint that allows same role in different groups
ALTER TABLE public.vessel_crew_requirements 
ADD CONSTRAINT vessel_crew_requirements_vessel_role_group_key 
UNIQUE (vessel_id, role, requirement_group);