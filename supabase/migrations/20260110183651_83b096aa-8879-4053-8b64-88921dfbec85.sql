-- ============================================
-- BOKNINGAR: Ta bort skeppare-rättigheter (endast läsning + skriv ut PM)
-- ============================================

-- Bookings: Ta bort skeppare INSERT/UPDATE
DROP POLICY IF EXISTS "Skeppare kan skapa bokningar" ON public.bookings;
DROP POLICY IF EXISTS "Skeppare kan uppdatera bokningar" ON public.bookings;

-- Skapa nya policies som bara tillåter admin
CREATE POLICY "Admin kan skapa bokningar"
ON public.bookings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin kan uppdatera bokningar"
ON public.bookings FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Booking crew: Ta bort skeppare
DROP POLICY IF EXISTS "Skeppare kan hantera bokningsbesattning" ON public.booking_crew;
CREATE POLICY "Admin kan hantera bokningsbesättning"
ON public.booking_crew FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Booking drinks: Ta bort skeppare
DROP POLICY IF EXISTS "Skeppare kan hantera bokningsdryck" ON public.booking_drinks;
CREATE POLICY "Admin kan hantera bokningsdryck"
ON public.booking_drinks FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Booking food: Ta bort skeppare
DROP POLICY IF EXISTS "Skeppare kan hantera bokningsmat" ON public.booking_food;
CREATE POLICY "Admin kan hantera bokningsmat"
ON public.booking_food FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Booking PMs: Skeppare kan endast LÄSA (för att skriva ut), inte skapa
DROP POLICY IF EXISTS "Skeppare kan skapa PM" ON public.booking_pms;
CREATE POLICY "Admin kan skapa PM"
ON public.booking_pms FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin kan uppdatera PM"
ON public.booking_pms FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin kan radera PM"
ON public.booking_pms FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Behåll läsrättighet för alla inloggade (så skeppare kan se och skriva ut)
DROP POLICY IF EXISTS "Inloggade kan se PM" ON public.booking_pms;
CREATE POLICY "Inloggade kan se PM"
ON public.booking_pms FOR SELECT
USING (auth.uid() IS NOT NULL);

-- ============================================
-- EGENKONTROLL: Ta bort skeppare-rättigheter
-- ============================================

-- Control point records: Ta bort skeppare
DROP POLICY IF EXISTS "Skeppare kan registrera kontroller" ON public.control_point_records;
DROP POLICY IF EXISTS "Admin och skeppare kan registrera kontroller" ON public.control_point_records;
CREATE POLICY "Admin kan registrera kontroller"
ON public.control_point_records FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin kan uppdatera kontroller"
ON public.control_point_records FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin kan radera kontroller"
ON public.control_point_records FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Vessel control point state: Ta bort skeppare
DROP POLICY IF EXISTS "Admin och skeppare kan uppdatera status" ON public.vessel_control_point_state;
CREATE POLICY "Admin kan uppdatera kontrollpunktsstatus"
ON public.vessel_control_point_state FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Control point attachments: Ta bort skeppare
DROP POLICY IF EXISTS "Skeppare kan ladda upp bilagor" ON public.control_point_attachments;
DROP POLICY IF EXISTS "Admin och skeppare kan hantera bilagor" ON public.control_point_attachments;
CREATE POLICY "Admin kan hantera kontrollpunktsbilagor"
ON public.control_point_attachments FOR ALL
USING (has_role(auth.uid(), 'admin'));