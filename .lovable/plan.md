## Problem

Avvikelser kan kopplas till en loggbok via `deviations.logbook_id`, men loggbokssidan visar aldrig dessa kopplingar. Användaren ser inte att det finns avvikelser kopplade till en loggbok, och från avvikelsesidan syns inte loggbokskopplingen tydligt heller.

## Lösning

### 1. Visa kopplade avvikelser i LogbookDetail

Lägga till en ny sektion i loggbokssidan (under sidopanelen eller som en egen rad) som:

- Hämtar avvikelser där `logbook_id = aktuell loggbok`
- Länkas till avvikelsedetaljsidan (`/portal/deviations/:id`)
- Visar en "Inga avvikelser" text om det inte finns några

Förslag på placering: i sidopanelen (`LogbookSidebar`) ovanför signatursektionen, som ett kompakt kort med rubrik "Avvikelser" och en badge med antal.

### 2. Visa loggbokskopplingen tydligare i DeviationDetail

I avvikelsedetaljsidan, om `logbook_id` finns:

- Visa en klickbar länk/badge som navigerar till loggboken (`/portal/logbook/:logbook_id`)
- Visa datum för den kopplade loggboken

### Tekniska detaljer

**LogbookDetail.tsx**: Ny query som hämtar `deviations` filtrerade på `logbook_id = id`.

**LogbookSidebar.tsx**: Ny prop `deviations` som renderar ett kort med avvikelselänkar.

**DeviationDetail.tsx**: I info-sektionen, lägg till en rad som visar "Kopplad loggbok" med klickbar länk om `deviation.logbook_id` finns.