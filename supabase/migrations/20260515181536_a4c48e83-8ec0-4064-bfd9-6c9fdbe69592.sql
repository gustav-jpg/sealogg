
CREATE POLICY "es_invoices superadmin read" ON public.es_invoices
  FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));

CREATE POLICY "es_invoices superadmin update" ON public.es_invoices
  FOR UPDATE TO authenticated USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));
