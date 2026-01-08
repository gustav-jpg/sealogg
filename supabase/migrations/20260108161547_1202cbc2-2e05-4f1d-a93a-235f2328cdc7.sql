-- Add requirement_group column to support alternative crew requirements
-- Requirements with the same group value must ALL be met together as one option
-- Different groups represent OR alternatives (if any group is fully satisfied, it's valid)
ALTER TABLE public.vessel_crew_requirements 
ADD COLUMN requirement_group text DEFAULT NULL;

-- Example: For MS Charm you would have:
-- Group A: befälhavare=1, matros=1
-- Group B: befälhavare=1, jungman=2
-- If either Group A OR Group B is satisfied, the vessel is properly crewed