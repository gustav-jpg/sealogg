-- Prevent passenger registrations from being modified when the session is locked (is_active = false)

CREATE OR REPLACE FUNCTION public.prevent_passenger_entries_when_session_locked()
RETURNS TRIGGER AS $$
DECLARE
  v_is_active boolean;
  v_session_id uuid;
BEGIN
  v_session_id := COALESCE(NEW.session_id, OLD.session_id);

  SELECT is_active INTO v_is_active
  FROM public.passenger_sessions
  WHERE id = v_session_id;

  IF v_is_active IS NULL THEN
    RAISE EXCEPTION 'Passenger session not found';
  END IF;

  IF v_is_active = false THEN
    RAISE EXCEPTION 'Passenger session is locked';
  END IF;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_entries_when_session_locked ON public.passenger_entries;

CREATE TRIGGER trg_prevent_entries_when_session_locked
BEFORE INSERT OR UPDATE OR DELETE ON public.passenger_entries
FOR EACH ROW
EXECUTE FUNCTION public.prevent_passenger_entries_when_session_locked();
