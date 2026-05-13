
ALTER TABLE public.bookings ALTER COLUMN customer_name DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN customer_email DROP NOT NULL;
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS email_format;
ALTER TABLE public.bookings ADD CONSTRAINT email_format
  CHECK (customer_email IS NULL OR customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_bookings_is_draft ON public.bookings (is_draft) WHERE is_draft = true;
