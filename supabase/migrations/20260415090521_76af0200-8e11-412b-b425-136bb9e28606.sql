
-- Create rustning_categories table
CREATE TABLE public.rustning_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rustning_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view rustning categories"
  ON public.rustning_categories FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "Org admins can manage rustning categories"
  ON public.rustning_categories FOR ALL
  TO authenticated
  USING (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()));

-- Create rustning_tasks table
CREATE TABLE public.rustning_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.rustning_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  notes TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,
  created_by UUID NOT NULL,
  assigned_to UUID REFERENCES public.profiles(id),
  due_date DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rustning_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view rustning tasks"
  ON public.rustning_tasks FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "Org members can create rustning tasks"
  ON public.rustning_tasks FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "Org members can update rustning tasks"
  ON public.rustning_tasks FOR UPDATE
  TO authenticated
  USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "Org admins can delete rustning tasks"
  ON public.rustning_tasks FOR DELETE
  TO authenticated
  USING (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()));

-- Index for performance
CREATE INDEX idx_rustning_tasks_org ON public.rustning_tasks(organization_id);
CREATE INDEX idx_rustning_tasks_category ON public.rustning_tasks(category_id);
CREATE INDEX idx_rustning_categories_org ON public.rustning_categories(organization_id);
