-- Add trip type enum
DO $$ BEGIN
  CREATE TYPE public.trip_type AS ENUM ('private', 'shared');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Add new columns to booking_departures
ALTER TABLE public.booking_departures
  ADD COLUMN IF NOT EXISTS trip_type public.trip_type NOT NULL DEFAULT 'shared',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS booking_deadline timestamp with time zone,
  ADD COLUMN IF NOT EXISTS skipper_id uuid;

-- Make route_id nullable so private trips can have free-form from/to instead of a fixed route
ALTER TABLE public.booking_departures
  ALTER COLUMN route_id DROP NOT NULL;

-- Free-form pickup/dropoff for private trips (used when route_id is null)
ALTER TABLE public.booking_departures
  ADD COLUMN IF NOT EXISTS pickup_location text,
  ADD COLUMN IF NOT EXISTS dropoff_location text;

-- Update public view RLS: only shared trips visible publicly
DROP POLICY IF EXISTS "Public can view future departures" ON public.booking_departures;
CREATE POLICY "Public can view future departures"
  ON public.booking_departures
  FOR SELECT
  TO anon, authenticated
  USING (
    trip_type = 'shared'
    AND status = ANY (ARRAY['planerad'::departure_status, 'fullbokad'::departure_status])
    AND departure_at > now()
    AND org_has_module(organization_id, 'bookings'::app_module)
  );

-- Update public booking insert: only allow on shared trips
DROP POLICY IF EXISTS "Public can create bookings" ON public.bookings;
CREATE POLICY "Public can create bookings"
  ON public.bookings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    departure_id IN (
      SELECT id FROM booking_departures
      WHERE trip_type = 'shared'
        AND status = 'planerad'::departure_status
        AND departure_at > now()
        AND org_has_module(organization_id, 'bookings'::app_module)
    )
  );

-- Update public ticket types view: only for shared trips
DROP POLICY IF EXISTS "Public can view ticket types" ON public.booking_ticket_types;
CREATE POLICY "Public can view ticket types"
  ON public.booking_ticket_types
  FOR SELECT
  TO anon, authenticated
  USING (
    departure_id IN (
      SELECT id FROM booking_departures
      WHERE trip_type = 'shared'
        AND status = ANY (ARRAY['planerad'::departure_status, 'fullbokad'::departure_status])
        AND departure_at > now()
        AND org_has_module(organization_id, 'bookings'::app_module)
    )
  );