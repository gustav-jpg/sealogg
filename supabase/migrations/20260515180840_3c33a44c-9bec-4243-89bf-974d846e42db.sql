
-- Allow superadmins (backoffice) to read and manage all orders globally
CREATE POLICY "es_orders superadmin read" ON public.es_orders
  FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));

CREATE POLICY "es_orders superadmin update" ON public.es_orders
  FOR UPDATE TO authenticated USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "es_order_items superadmin read" ON public.es_order_items
  FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));
