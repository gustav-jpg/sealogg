
CREATE OR REPLACE FUNCTION public.seed_default_exercise_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.exercise_categories (organization_id, name, description, is_active) VALUES
    (NEW.id, 'Brand', 'Brandövning och släckningsrutiner', true),
    (NEW.id, 'Grundstötning', 'Övning för hantering av grundstötning', true),
    (NEW.id, 'Kollision', 'Övning för hantering av kollision', true),
    (NEW.id, 'Manöverbord (MOB)', NULL, true),
    (NEW.id, 'Övergivande av fartyg', 'Övning för evakuering och övergivande av fartyg', true),
    (NEW.id, 'Övrigt, se beskrivning', NULL, true),
    (NEW.id, 'Sjukdomsfall', 'Övning för hantering av sjukdomsfall ombord', true),
    (NEW.id, 'Vattenförorening', 'Övning för hantering av vattenförorening', true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_exercise_categories_on_org_create
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.seed_default_exercise_categories();
