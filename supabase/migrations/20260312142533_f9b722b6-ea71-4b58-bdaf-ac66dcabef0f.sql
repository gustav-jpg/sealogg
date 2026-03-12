
-- Billing frequency enum
CREATE TYPE public.billing_frequency AS ENUM ('monthly', 'yearly', 'quarterly');

-- Billing status enum  
CREATE TYPE public.billing_status AS ENUM ('active', 'overdue', 'cancelled', 'trial');

-- Organization billing tracking table
CREATE TABLE public.organization_billing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  billing_frequency billing_frequency NOT NULL DEFAULT 'monthly',
  status billing_status NOT NULL DEFAULT 'active',
  price_sek INTEGER NOT NULL DEFAULT 0,
  last_paid_at DATE,
  next_invoice_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.organization_billing ENABLE ROW LEVEL SECURITY;

-- Only superadmins can manage billing
CREATE POLICY "Superadmins can manage billing"
  ON public.organization_billing
  FOR ALL
  TO authenticated
  USING (is_superadmin(auth.uid()))
  WITH CHECK (is_superadmin(auth.uid()));
