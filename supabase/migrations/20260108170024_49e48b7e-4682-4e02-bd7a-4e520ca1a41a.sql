-- ===========================================
-- ENUMS
-- ===========================================
CREATE TYPE deviation_type AS ENUM ('incident', 'tillbud', 'avvikelse', 'ovrigt');
CREATE TYPE deviation_severity AS ENUM ('lag', 'medel', 'hog');
CREATE TYPE deviation_status AS ENUM ('oppen', 'under_utredning', 'aterrapporterad', 'stangd');
CREATE TYPE fault_priority AS ENUM ('lag', 'normal', 'hog', 'kritisk');
CREATE TYPE fault_status AS ENUM ('ny', 'varvsatgard', 'arbete_pagar', 'atgardad', 'avslutad');
CREATE TYPE control_type AS ENUM ('calendar', 'engine_hours');
CREATE TYPE control_status AS ENUM ('ok', 'kommande', 'forfallen');

-- ===========================================
-- AVVIKELSER (DEVIATIONS)
-- ===========================================
CREATE TABLE public.deviations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id UUID NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
  logbook_id UUID REFERENCES public.logbooks(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  type deviation_type NOT NULL,
  severity deviation_severity NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status deviation_status NOT NULL DEFAULT 'oppen',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

ALTER TABLE public.deviations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla inloggade kan se avvikelser"
  ON public.deviations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Alla inloggade kan skapa avvikelser"
  ON public.deviations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admin och skeppare kan uppdatera avvikelser"
  ON public.deviations FOR UPDATE TO authenticated
  USING (is_admin_or_skeppare(auth.uid()));

CREATE POLICY "Admin kan radera avvikelser"
  ON public.deviations FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Deviation Actions (åtgärdslista)
CREATE TABLE public.deviation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deviation_id UUID NOT NULL REFERENCES public.deviations(id) ON DELETE CASCADE,
  action_text TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deviation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla inloggade kan se åtgärder"
  ON public.deviation_actions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin och skeppare kan hantera åtgärder"
  ON public.deviation_actions FOR ALL TO authenticated
  USING (is_admin_or_skeppare(auth.uid()));

-- Deviation Responses (återrapportering)
CREATE TABLE public.deviation_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deviation_id UUID NOT NULL REFERENCES public.deviations(id) ON DELETE CASCADE,
  response_text TEXT NOT NULL,
  responded_by UUID NOT NULL,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deviation_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla inloggade kan se återrapportering"
  ON public.deviation_responses FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin kan hantera återrapportering"
  ON public.deviation_responses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Deviation Attachments
CREATE TABLE public.deviation_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deviation_id UUID NOT NULL REFERENCES public.deviations(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deviation_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla inloggade kan se bilagor"
  ON public.deviation_attachments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Alla inloggade kan ladda upp bilagor"
  ON public.deviation_attachments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Admin kan radera bilagor"
  ON public.deviation_attachments FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- ===========================================
-- FELÄRENDEN (FAULT CASES)
-- ===========================================
CREATE TABLE public.fault_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id UUID NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority fault_priority NOT NULL DEFAULT 'normal',
  status fault_status NOT NULL DEFAULT 'ny',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

ALTER TABLE public.fault_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla inloggade kan se felärenden"
  ON public.fault_cases FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Alla inloggade kan skapa felärenden"
  ON public.fault_cases FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admin och skeppare kan uppdatera felärenden"
  ON public.fault_cases FOR UPDATE TO authenticated
  USING (is_admin_or_skeppare(auth.uid()));

CREATE POLICY "Admin kan radera felärenden"
  ON public.fault_cases FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Fault Comments
CREATE TABLE public.fault_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fault_case_id UUID NOT NULL REFERENCES public.fault_cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fault_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla inloggade kan se kommentarer"
  ON public.fault_comments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Alla inloggade kan skapa kommentarer"
  ON public.fault_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Fault Attachments
CREATE TABLE public.fault_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fault_case_id UUID NOT NULL REFERENCES public.fault_cases(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.fault_comments(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fault_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla inloggade kan se bilagor"
  ON public.fault_attachments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Alla inloggade kan ladda upp bilagor"
  ON public.fault_attachments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Admin kan radera bilagor"
  ON public.fault_attachments FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- ===========================================
-- EGENKONTROLL (CONTROL POINTS)
-- ===========================================
CREATE TABLE public.control_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type control_type NOT NULL,
  interval_months INTEGER,
  interval_engine_hours INTEGER,
  applies_to_all_vessels BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  machine_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.control_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla inloggade kan se kontrollpunkter"
  ON public.control_points FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin kan hantera kontrollpunkter"
  ON public.control_points FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Control Point Vessels (for specific vessel assignment)
CREATE TABLE public.control_point_vessels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_point_id UUID NOT NULL REFERENCES public.control_points(id) ON DELETE CASCADE,
  vessel_id UUID NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(control_point_id, vessel_id)
);

ALTER TABLE public.control_point_vessels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla inloggade kan se tilldelningar"
  ON public.control_point_vessels FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin kan hantera tilldelningar"
  ON public.control_point_vessels FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Vessel Control Point State
CREATE TABLE public.vessel_control_point_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id UUID NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
  control_point_id UUID NOT NULL REFERENCES public.control_points(id) ON DELETE CASCADE,
  engine_id UUID REFERENCES public.vessel_engine_hours(id) ON DELETE SET NULL,
  last_done_date DATE,
  last_done_at_engine_hours INTEGER,
  next_due_date DATE,
  next_due_at_engine_hours INTEGER,
  status control_status NOT NULL DEFAULT 'ok',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vessel_id, control_point_id, engine_id)
);

ALTER TABLE public.vessel_control_point_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla inloggade kan se status"
  ON public.vessel_control_point_state FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin och skeppare kan uppdatera status"
  ON public.vessel_control_point_state FOR ALL TO authenticated
  USING (is_admin_or_skeppare(auth.uid()));

-- Control Point Records (historik)
CREATE TABLE public.control_point_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_point_id UUID NOT NULL REFERENCES public.control_points(id) ON DELETE CASCADE,
  vessel_id UUID NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
  engine_id UUID REFERENCES public.vessel_engine_hours(id) ON DELETE SET NULL,
  performed_by UUID NOT NULL,
  performed_at DATE NOT NULL,
  engine_hours_at_perform INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.control_point_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla inloggade kan se historik"
  ON public.control_point_records FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Alla inloggade kan skapa poster"
  ON public.control_point_records FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = performed_by);

-- Control Point Attachments
CREATE TABLE public.control_point_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.control_point_records(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.control_point_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla inloggade kan se bilagor"
  ON public.control_point_attachments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Alla inloggade kan ladda upp bilagor"
  ON public.control_point_attachments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

-- ===========================================
-- TRIGGERS FOR updated_at
-- ===========================================
CREATE TRIGGER update_deviations_updated_at
  BEFORE UPDATE ON public.deviations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fault_cases_updated_at
  BEFORE UPDATE ON public.fault_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_control_points_updated_at
  BEFORE UPDATE ON public.control_points
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vessel_control_point_state_updated_at
  BEFORE UPDATE ON public.vessel_control_point_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- STORAGE BUCKET FOR ATTACHMENTS
-- ===========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false);

CREATE POLICY "Alla inloggade kan ladda upp bilagor"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Alla inloggade kan se bilagor"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attachments');

CREATE POLICY "Admin kan radera bilagor"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND has_role(auth.uid(), 'admin'));