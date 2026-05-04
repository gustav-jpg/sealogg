
-- Drop dependent functions first
DROP FUNCTION IF EXISTS public.get_user_modules(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.org_has_module(uuid, public.app_module) CASCADE;

-- Recreate the enum without 'bookings'
ALTER TYPE public.app_module RENAME TO app_module_old;

CREATE TYPE public.app_module AS ENUM (
  'logbook',
  'deviations',
  'fault_cases',
  'self_control',
  'checklists',
  'documents',
  'rustning'
);

ALTER TABLE public.organization_features
  ALTER COLUMN module TYPE public.app_module
  USING module::text::public.app_module;

DROP TYPE public.app_module_old;

-- Recreate the dependent functions using the new type
CREATE OR REPLACE FUNCTION public.get_user_modules(_user_id uuid)
RETURNS app_module[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT ARRAY_AGG(DISTINCT of.module)
  FROM public.organization_features of
  INNER JOIN public.organization_members om ON of.organization_id = om.organization_id
  WHERE om.user_id = _user_id
    AND of.is_active = true
    AND of.starts_at <= CURRENT_DATE
    AND (of.expires_at IS NULL OR of.expires_at >= CURRENT_DATE)
$function$;

CREATE OR REPLACE FUNCTION public.org_has_module(_org_id uuid, _module app_module)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_features
    WHERE organization_id = _org_id
      AND module = _module
      AND is_active = true
      AND starts_at <= CURRENT_DATE
      AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
  )
$function$;
