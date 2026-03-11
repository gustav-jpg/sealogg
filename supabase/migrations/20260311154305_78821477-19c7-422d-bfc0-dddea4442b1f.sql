
-- FAQ items table for support page
CREATE TABLE public.faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'Allmänt',
  question text NOT NULL,
  answer text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

-- Public read for published items (no auth required for support page)
CREATE POLICY "Anyone can read published FAQ items"
  ON public.faq_items FOR SELECT
  USING (is_published = true);

-- Org admins can manage their FAQ items
CREATE POLICY "Org admins can insert FAQ items"
  ON public.faq_items FOR INSERT
  TO authenticated
  WITH CHECK (is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org admins can update FAQ items"
  ON public.faq_items FOR UPDATE
  TO authenticated
  USING (is_org_admin(auth.uid(), organization_id))
  WITH CHECK (is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org admins can delete FAQ items"
  ON public.faq_items FOR DELETE
  TO authenticated
  USING (is_org_admin(auth.uid(), organization_id));

-- Superadmins can do everything
CREATE POLICY "Superadmins can manage all FAQ items"
  ON public.faq_items FOR ALL
  TO authenticated
  USING (is_superadmin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_faq_items_updated_at
  BEFORE UPDATE ON public.faq_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
