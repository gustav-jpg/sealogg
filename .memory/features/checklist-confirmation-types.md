# Memory: features/checklist-confirmation-types
Updated: 2026-02-05

Checkliststeg stöder tre bekräftelsetyper:

1. **Checkbox** - Enkel bekräftelse med en enda kryssruta
2. **Ja/Nej** - Bekräftelse med ja/nej-alternativ
3. **Checklista** - Flera kontrollpunkter som alla måste kryssas i innan steget kan godkännas

För "Checklista"-typen lagras punkterna i `checklist_items` (text array) i `checklist_steps`-tabellen. Vid utförande visas alla punkter med checkboxar, och OK-knappen är inaktiverad tills alla punkter är markerade.
