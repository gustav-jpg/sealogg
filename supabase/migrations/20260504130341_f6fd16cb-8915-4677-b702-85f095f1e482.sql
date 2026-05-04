ALTER TABLE public.booking_taxi_requests
  ADD CONSTRAINT booking_taxi_requests_vessel_id_fkey
  FOREIGN KEY (assigned_vessel_id) REFERENCES public.vessels(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';