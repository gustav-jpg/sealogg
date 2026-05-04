DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'bookings' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_module')
  ) THEN
    ALTER TYPE public.app_module ADD VALUE 'bookings';
  END IF;
END$$;