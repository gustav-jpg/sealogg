CREATE OR REPLACE FUNCTION public.seed_default_certificate_types(org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO certificate_types (organization_id, name, description) VALUES
    -- Behörighetsbevis (CoC)
    (org_id, 'Fartygsbefäl klass VIII', 'Behörighetsbevis (CoC)'),
    (org_id, 'Fartygsbefäl klass VII', 'Behörighetsbevis (CoC)'),
    (org_id, 'Fartygsbefäl klass VI', 'Behörighetsbevis (CoC)'),
    (org_id, 'Maskinbefäl klass VIII', 'Behörighetsbevis (CoC)'),
    -- Behörighetsintyg (Ratings)
    (org_id, 'Lättmatros', 'Behörighetsintyg (Rating)'),
    (org_id, 'Matros', 'Behörighetsintyg (Rating)'),
    -- Säkerhetscertifikat – Grund
    (org_id, 'Säkerhetsutbildning (Basic Safety / Rederiintern)', 'Grundläggande säkerhetscertifikat'),
    -- Säkerhetscertifikat – Avancerade
    (org_id, 'Avancerad brandbekämpning', 'Avancerat säkerhetscertifikat'),
    (org_id, 'Räddningsfarkoster och beredskapsbåtar (PSCRB)', 'Avancerat säkerhetscertifikat'),
    -- Specialbehörigheter (passagerarfartyg)
    (org_id, 'Krishantering', 'Specialbehörighet passagerarfartyg'),
    -- Medicinska certifikat
    (org_id, 'Läkarintyg för sjöfolk', 'Medicinskt certifikat'),
    (org_id, 'Medical First Aid', 'Medicinskt certifikat'),
    -- Radiocertifikat
    (org_id, 'SRC (Short Range Certificate)', 'Radiocertifikat'),
    (org_id, 'ROC (Restricted Operator Certificate)', 'Radiocertifikat')
  ON CONFLICT DO NOTHING;
END;
$function$;