
-- Create spare parts table
CREATE TABLE public.spare_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  vessel_id UUID NOT NULL REFERENCES public.vessels(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  part_number TEXT,
  location TEXT,
  quantity INTEGER DEFAULT 0,
  min_quantity INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.spare_parts ENABLE ROW LEVEL SECURITY;

-- Org members can view spare parts
CREATE POLICY "Org members can view spare parts"
ON public.spare_parts FOR SELECT
USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

-- Admins and skeppare can manage spare parts
CREATE POLICY "Admin/skeppare can manage spare parts"
ON public.spare_parts FOR ALL
USING (is_admin_or_skeppare(auth.uid()) AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
WITH CHECK (is_admin_or_skeppare(auth.uid()) AND organization_id IN (SELECT get_user_org_ids(auth.uid())));

-- All authenticated can insert
CREATE POLICY "Authenticated users can insert spare parts"
ON public.spare_parts FOR INSERT
WITH CHECK (auth.uid() = created_by AND organization_id IN (SELECT get_user_org_ids(auth.uid())));

-- Trigger for updated_at
CREATE TRIGGER update_spare_parts_updated_at
BEFORE UPDATE ON public.spare_parts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_spare_parts_vessel ON public.spare_parts(vessel_id);
CREATE INDEX idx_spare_parts_org ON public.spare_parts(organization_id);
