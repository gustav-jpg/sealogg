
-- Remove the bookings module from organization_features first
DELETE FROM public.organization_features WHERE module = 'bookings';

-- Drop all booking-related tables (CASCADE removes RLS policies, triggers, FKs)
DROP TABLE IF EXISTS public.booking_audit_logs CASCADE;
DROP TABLE IF EXISTS public.booking_crew CASCADE;
DROP TABLE IF EXISTS public.booking_food CASCADE;
DROP TABLE IF EXISTS public.booking_drinks CASCADE;
DROP TABLE IF EXISTS public.booking_pms CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.menus CASCADE;
DROP TABLE IF EXISTS public.drink_extras CASCADE;
DROP TABLE IF EXISTS public.drink_packages CASCADE;
