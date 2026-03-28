
CREATE TABLE public.engine_refills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logbook_id uuid NOT NULL REFERENCES public.logbooks(id) ON DELETE CASCADE,
  engine_type text NOT NULL,
  engine_number integer NOT NULL DEFAULT 1,
  engine_name text,
  refill_type text NOT NULL CHECK (refill_type IN ('olja', 'glykol')),
  liters numeric(8,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.engine_refills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view engine refills"
ON public.engine_refills FOR SELECT TO authenticated
USING (logbook_id IN (
  SELECT l.id FROM logbooks l JOIN vessels v ON v.id = l.vessel_id
  WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
));

CREATE POLICY "Skeppare kan hantera engine refills"
ON public.engine_refills FOR ALL TO authenticated
USING (is_admin_or_skeppare(auth.uid()));
