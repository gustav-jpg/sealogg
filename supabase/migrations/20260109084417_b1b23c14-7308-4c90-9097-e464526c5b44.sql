-- Checklist Templates
CREATE TABLE public.checklist_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  interval_days INTEGER, -- NULL = manual/event-based
  is_active BOOLEAN NOT NULL DEFAULT true,
  applies_to_all_vessels BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Checklist Template Vessels (for specific vessel assignments)
CREATE TABLE public.checklist_template_vessels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  vessel_id UUID NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(checklist_template_id, vessel_id)
);

-- Checklist Steps
CREATE TABLE public.checklist_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  instruction TEXT NOT NULL,
  confirmation_type TEXT NOT NULL DEFAULT 'checkbox' CHECK (confirmation_type IN ('checkbox', 'yes_no')),
  requires_comment BOOLEAN NOT NULL DEFAULT false,
  requires_photo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Checklist Execution Status enum
CREATE TYPE public.checklist_execution_status AS ENUM ('in_progress', 'completed', 'failed');

-- Checklist Executions
CREATE TABLE public.checklist_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  vessel_id UUID NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
  started_by UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status public.checklist_execution_status NOT NULL DEFAULT 'in_progress',
  next_due_at DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Checklist Step Results
CREATE TABLE public.checklist_step_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_execution_id UUID NOT NULL REFERENCES public.checklist_executions(id) ON DELETE CASCADE,
  checklist_step_id UUID NOT NULL REFERENCES public.checklist_steps(id) ON DELETE CASCADE,
  confirmed_by UUID NOT NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  value TEXT NOT NULL, -- 'checked', 'yes', 'no'
  comment TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(checklist_execution_id, checklist_step_id)
);

-- Enable RLS
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template_vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_step_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for checklist_templates
CREATE POLICY "Admin kan hantera checklistmallar" ON public.checklist_templates
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Alla inloggade kan se aktiva checklistmallar" ON public.checklist_templates
  FOR SELECT USING (is_active = true);

-- RLS Policies for checklist_template_vessels
CREATE POLICY "Admin kan hantera fartygstilldelningar" ON public.checklist_template_vessels
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Organisationsmedlemmar kan se tilldelningar" ON public.checklist_template_vessels
  FOR SELECT USING (
    vessel_id IN (SELECT v.id FROM vessels v WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid())))
  );

-- RLS Policies for checklist_steps
CREATE POLICY "Admin kan hantera checkliststeg" ON public.checklist_steps
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Alla inloggade kan se checkliststeg" ON public.checklist_steps
  FOR SELECT USING (true);

-- RLS Policies for checklist_executions
CREATE POLICY "Skeppare kan skapa checklistexekveringar" ON public.checklist_executions
  FOR INSERT WITH CHECK (is_admin_or_skeppare(auth.uid()));

CREATE POLICY "Skeppare kan uppdatera checklistexekveringar" ON public.checklist_executions
  FOR UPDATE USING (is_admin_or_skeppare(auth.uid()));

CREATE POLICY "Organisationsmedlemmar kan se checklistexekveringar" ON public.checklist_executions
  FOR SELECT USING (
    vessel_id IN (SELECT v.id FROM vessels v WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid())))
  );

-- RLS Policies for checklist_step_results
CREATE POLICY "Skeppare kan skapa stegresultat" ON public.checklist_step_results
  FOR INSERT WITH CHECK (is_admin_or_skeppare(auth.uid()));

CREATE POLICY "Organisationsmedlemmar kan se stegresultat" ON public.checklist_step_results
  FOR SELECT USING (
    checklist_execution_id IN (
      SELECT ce.id FROM checklist_executions ce
      JOIN vessels v ON v.id = ce.vessel_id
      WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_checklist_templates_updated_at
  BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for checklist photos
INSERT INTO storage.buckets (id, name, public) VALUES ('checklist-photos', 'checklist-photos', false);

-- Storage policies for checklist photos
CREATE POLICY "Inloggade kan ladda upp checklistfoton" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'checklist-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Organisationsmedlemmar kan se checklistfoton" ON storage.objects
  FOR SELECT USING (bucket_id = 'checklist-photos' AND auth.uid() IS NOT NULL);