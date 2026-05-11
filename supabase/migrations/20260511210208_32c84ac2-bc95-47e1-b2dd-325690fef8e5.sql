UPDATE public.control_point_records
SET created_at = (performed_at::timestamp + time '12:00') AT TIME ZONE 'Europe/Stockholm'
WHERE vessel_id = '56f90f68-0fe2-4662-97c5-b2791a0b926d';