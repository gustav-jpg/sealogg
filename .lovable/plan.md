

# Självregistrering med AI-certifikatgranskning

## Översikt

Nya anställda besöker `/ny`, anger en 4-siffrig organisationskod, registrerar sig med namn/e-post/lösenord, laddar upp certifikatfoton som granskas av AI, och hamnar sedan i en väntekö. Administratören granskar och godkänner under Besättning.

## Flöde

```text
/ny → PIN-kod → Registreringsformulär → Certifikatuppladdning (AI-granskning) → "Registrering klar"
                                                                                         │
Admin: Besättning → Väntande registreringar → Granska certifikat → Välj roll → Godkänn ──┘
```

## Databas

1. **Ny tabell `organization_registration_codes`**
   - `id`, `organization_id` (FK), `code` (text, 4 siffror), `is_active`, `created_at`
   - RLS: admins kan läsa/skriva för sin org, anonym SELECT via edge function

2. **Ny tabell `pending_registrations`**
   - `id`, `user_id` (FK auth.users), `organization_id` (FK), `status` (pending/approved/rejected), `approved_by`, `approved_at`, `assigned_role` (org_role), `created_at`
   - RLS: användaren kan läsa sin egen, org_admin kan läsa/uppdatera för sin org

3. **Ny tabell `pending_certificates`**
   - `id`, `registration_id` (FK pending_registrations), `file_url`, `ai_suggested_type` (text), `ai_suggested_expiry` (date), `ai_confidence` (numeric), `confirmed_type_id` (FK certificate_types, nullable), `confirmed_expiry` (date, nullable), `created_at`
   - RLS: ägaren kan läsa/skriva, org_admin kan läsa/uppdatera

4. **Storage bucket** `registration-certificates` (privat)

## Edge Functions

1. **`verify-registration-code`** — tar emot en 4-siffrig kod, returnerar `organization_id` + organisationsnamn. Ingen autentisering krävs.

2. **`analyze-certificate`** — tar emot en bild (base64), skickar till Lovable AI (gemini-2.5-pro, bra på bild+text) med prompt att identifiera certifikattyp, utgångsdatum och utfärdandedatum. Returnerar strukturerad JSON. Autentiserad.

## Frontend

### Steg 1: Ny sida `/ny` (omdirigerar till `/portal/register` med query param)
- Alternativt bygger vi om `/portal/register` till ett flerstegsflöde
- **Steg 1**: PIN-kod (verifieras mot `verify-registration-code`)
- **Steg 2**: Namn, e-post, lösenord → skapar konto via `signUp`, skapar `pending_registrations`-rad
- **Steg 3**: Certifikatuppladdning — kamera/fil, visar AI-förslag (typ + datum) som användaren kan justera. Kan lägga till flera certifikat.
- **Steg 4**: "Registrering klar! En administratör kommer granska din ansökan."

### Steg 2: Admin — Besättning (utöka befintlig sida)
- Ny flik/sektion "Väntande registreringar" under Besättning
- Visar lista med väntande användare, deras uppladdade certifikat och AI-förslag
- Admin kan: se certifikatbild, justera typ/datum, välja roll (Skeppare/Däcksman/etc), godkänna eller avvisa
- Vid godkännande: skapar `organization_members`-rad + `user_certificates`-rader + tar bort pending-status

## Tekniska detaljer

- **AI-modell**: `google/gemini-2.5-pro` (bäst på bild+text-analys)
- **Certifikatanalys-prompt**: Instruerar AI att identifiera dokumenttyp (sjöbefälscertifikat, maskinbefälscertifikat, etc), utgångsdatum, utfärdandedatum ur bilden
- **Routing**: `/ny` → redirect till `/portal/register`, eller fristående sida. Route läggs till i App.tsx som publik
- **Användaren loggas INTE in automatiskt** efter registrering — kontot är inaktivt tills admin godkänner
- **Auto-confirm email** behöver aktiveras för detta flöde (annars kan inte användaren logga in efter godkännande utan att verifiera email först) — alternativt hanteras via edge function med service role

## Implementationsordning

1. Databasmigrering (3 tabeller + storage bucket + RLS)
2. Edge function `verify-registration-code`
3. Edge function `analyze-certificate`
4. Ombyggd registreringssida (flerstegsflöde)
5. Admin-granskning i Besättning
6. Koppling: godkännande skapar org_member + certificates

