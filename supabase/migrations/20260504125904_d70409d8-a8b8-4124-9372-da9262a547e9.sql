ALTER TABLE public.booking_departures
  ADD CONSTRAINT booking_departures_vessel_id_fkey
  FOREIGN KEY (vessel_id) REFERENCES public.vessels(id) ON DELETE RESTRICT;

NOTIFY pgrst, 'reload schema';