-- Skapa ny tabell för fartygspecifika certifikatkrav per roll
CREATE TABLE public.vessel_role_certificates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    vessel_id UUID NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
    role public.crew_role NOT NULL,
    certificate_type_id UUID NOT NULL REFERENCES public.certificate_types(id) ON DELETE CASCADE,
    group_name TEXT, -- För OR-logik: certifikat i samma grupp = ett av dem krävs
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(vessel_id, role, certificate_type_id)
);

-- Aktivera RLS
ALTER TABLE public.vessel_role_certificates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin kan hantera fartygscertifikatkrav" 
ON public.vessel_role_certificates 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Alla kan se fartygscertifikatkrav" 
ON public.vessel_role_certificates 
FOR SELECT 
USING (true);

-- Ta bort globala rollregler-tabellen
DROP TABLE IF EXISTS public.role_certificate_rules;

-- Ta bort profile_crew_roles-tabellen
DROP TABLE IF EXISTS public.profile_crew_roles;