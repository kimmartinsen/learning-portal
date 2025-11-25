# Fullkommen løsning: Fleksible program-avhengigheter

## Oversikt

Dette er en komplett implementering av et fleksibelt system for å definere avhengigheter mellom kurs i et opplæringsprogram. Systemet gir administrator full kontroll over når og hvordan kurs skal låses opp for brukere.

## Funksjonalitet

### 4 Typer Avhengigheter

1. **Tilgjengelig umiddelbart** (`none`)
   - Kurset er alltid tilgjengelig for brukere som har fått det tildelt
   - Ingen forutsetninger

2. **Åpnes automatisk etter forrige** (`previous_auto`)
   - Kurset låses opp automatisk når det forrige kurset i sekvensen er fullført
   - Ingen manuell handling kreves

3. **Krever godkjenning etter forrige** (`previous_manual`)
   - Når det forrige kurset er fullført, endres kurset til "pending" status
   - Administrator må manuelt godkjenne/låse opp kurset før brukeren får tilgang

4. **Avhenger av spesifikke kurs** (`specific_courses`)
   - Administrator velger ett eller flere spesifikke kurs som må fullføres
   - Kurset låses opp automatisk når ALLE valgte kurs er fullført
   - Gir maksimal fleksibilitet - kan lage komplekse avhengighetsgrafer

### Visuell Struktur-editor

- **Dra-og-slipp**: Endre rekkefølgen på kurs enkelt
- **Per-kurs konfigurasjon**: Hver kurs får sin egen avhengighetsregel
- **Sanntids-preview**: Se forklaringer og valideringer mens du redigerer
- **Checkbox-selector**: Velg spesifikke kurs for `specific_courses` type

## Database-struktur

### Nye felter i `training_programs`

```sql
prerequisite_type VARCHAR(50) DEFAULT 'none'
  -- Mulige verdier: 'none', 'previous_auto', 'previous_manual', 'specific_courses'

prerequisite_course_ids UUID[] DEFAULT '{}'
  -- Array av kurs-IDer som må fullføres (kun for 'specific_courses')
```

### Nye statuser i `program_assignments`

- `locked` - Kurset er låst fordi forutsetninger ikke er oppfylt
- `pending` - Forutsetninger er oppfylt, men venter på admin-godkjenning

### Automatiske triggere

Når et kurs fullføres (`status = 'completed'`):
1. Systemet finner alle kurs i samme program som kan være avhengig av det fullførte kurset
2. For hvert avhengig kurs sjekkes om forutsetningene nå er oppfylt
3. Status oppdateres automatisk:
   - `previous_auto`: `locked` → `assigned`
   - `previous_manual`: `locked` → `pending`
   - `specific_courses`: `locked` → `assigned` (når alle er fullført)

## Filstruktur

### Database-migrasjoner

```
docs/database-migrations/
├── course-prerequisites.sql           # Hovedmigrasjon med alle endringer
├── update-user-assignments-view.sql   # Oppdaterer view for å støtte locked/pending
└── APPLY-ALL-MIGRATIONS.sql           # Kjør denne i Supabase for å aktivere alt
```

### Nye komponenter

```
components/admin/programs/
└── CourseListItem.tsx                 # Komponent for hver kurs i listen (dra-og-slipp)

app/(dashboard)/admin/programs/
└── [themeId]/structure/page.tsx       # Struktur-editor side
```

### Oppdaterte filer

```
types/enhanced-database.types.ts       # Lagt til prerequisite_type og prerequisite_course_ids
app/(dashboard)/admin/programs/page.tsx  # Lagt til "Struktur" knapp ved hvert program
app/(dashboard)/my-learning/page.tsx   # Støtter allerede locked/pending via view
```

## Bruksanvisning

### For Administrator

1. **Gå til Kursadministrasjon** (`/admin/programs`)
2. **Finn programmet** du vil konfigurere
3. **Klikk "Struktur"** knappen ved programmet
4. **Organiser kursene**:
   - Dra kursene i ønsket rekkefølge
   - Velg avhengighetstype for hvert kurs
   - For "spesifikke kurs": Velg hvilke kurs som må fullføres
5. **Klikk "Lagre endringer"**

### For Brukere

- **Låste kurs** (`locked`): Vises grået ut med låse-ikon
- **Venter på godkjenning** (`pending`): Vises med pause-ikon
- **Tilgjengelige kurs**: Normal visning med "Start kurs" knapp
- Kursnummer vises for å indikere rekkefølgen (1, 2, 3...)

### Manuell godkjenning

Når et kurs venter på godkjenning (`pending`):
1. Administrator går til **Oversikt** (`/admin/themes`)
2. Finner brukeren og det pending kurset
3. Klikker **"Lås opp"** knappen
4. Kurset blir umiddelbart tilgjengelig for brukeren

## Implementeringsdetaljer

### SQL-funksjoner

#### `check_course_prerequisites_met(user_id, program_id)`

Sjekker om en bruker har oppfylt alle forutsetninger for et kurs.

**Returverdier:**
- `TRUE`: Forutsetninger oppfylt
- `FALSE`: Forutsetninger ikke oppfylt

**Logikk:**
- `none`: Alltid `TRUE`
- `previous_auto`/`previous_manual`: Sjekk om forrige kurs (sort_order - 1) er fullført
- `specific_courses`: Sjekk om alle kurs i `prerequisite_course_ids` er fullført

#### `calculate_course_status_from_prerequisites(user_id, program_id, current_status)`

Beregner hvilken status et kurs skal ha basert på forutsetninger.

**Returverdier:**
- `assigned`: Klar til å starte
- `locked`: Forutsetninger ikke oppfylt
- `pending`: Forutsetninger oppfylt, venter på godkjenning
- `completed`/`in_progress`/`started`: Bevares hvis allerede i gang

#### `handle_course_completion()` (Trigger)

Kjøres automatisk når en `program_assignment.status` oppdateres til `completed`.

**Prosess:**
1. Finn alle kurs i samme program med avhengigheter
2. Identifiser hvilke som avhenger av det fullførte kurset
3. Beregn ny status for hver avhengig kurs
4. Oppdater status hvis den har endret seg

### TypeScript-typer

```typescript
export interface EnhancedTrainingProgram {
  // ... eksisterende felter
  prerequisite_type?: 'none' | 'previous_auto' | 'previous_manual' | 'specific_courses'
  prerequisite_course_ids?: string[]
}
```

### React-komponenter

#### CourseListItem

**Props:**
- `course`: Kurset som vises
- `index`: Posisjon i listen (for kursnummer)
- `allCourses`: Alle kurs i programmet (for å velge dependencies)
- `onPrerequisiteChange`: Callback når prerequisites endres
- `onDragStart/onDragOver/onDragEnd`: Callbacks for dra-og-slipp

**Funksjoner:**
- Viser kursinformasjon
- Dropdown for å velge prerequisite type
- Checkbox-liste for å velge spesifikke kurs
- Sanntids forklaringer av hva valget betyr

#### ProgramStructurePage

**State:**
- `courses`: Liste over kurs (lokalt state for dra-og-slipp)
- `draggedIndex`: Hvilket kurs som dras
- `hasChanges`: Om det er ulagrede endringer

**Funksjoner:**
- `handleDragStart/handleDragOver/handleDragEnd`: Håndterer dra-og-slipp
- `handlePrerequisiteChange`: Oppdaterer prerequisite settings
- `handleSave`: Lagrer alle endringer til database

## Testing

### Test-scenario 1: Lineær sekvens med auto

1. Opprett program med 3 kurs: A, B, C
2. Sett A: `none`, B: `previous_auto`, C: `previous_auto`
3. Tildel programmet til en bruker
4. **Forventet**: A er tilgjengelig, B og C er locked
5. Fullfør A
6. **Forventet**: B blir automatisk assigned, C fortsatt locked
7. Fullfør B
8. **Forventet**: C blir automatisk assigned

### Test-scenario 2: Manuell godkjenning

1. Opprett program med 2 kurs: A, B
2. Sett A: `none`, B: `previous_manual`
3. Tildel programmet til en bruker
4. **Forventet**: A er tilgjengelig, B er locked
5. Fullfør A
6. **Forventet**: B endres til pending
7. Admin går til Oversikt og låser opp B
8. **Forventet**: B blir assigned og tilgjengelig

### Test-scenario 3: Komplekse avhengigheter

1. Opprett program med 4 kurs: Intro, Teori A, Teori B, Eksamen
2. Sett:
   - Intro: `none`
   - Teori A: `previous_auto` (etter Intro)
   - Teori B: `previous_auto` (etter Intro)
   - Eksamen: `specific_courses` → velg [Teori A, Teori B]
3. Tildel programmet til en bruker
4. **Forventet**: Intro tilgjengelig, resten locked
5. Fullfør Intro
6. **Forventet**: Teori A og Teori B blir assigned, Eksamen locked
7. Fullfør Teori A
8. **Forventet**: Eksamen fortsatt locked (krever begge)
9. Fullfør Teori B
10. **Forventet**: Eksamen blir assigned

## Fordeler med denne løsningen

✅ **Maksimal fleksibilitet**: Hver kurs kan ha sin egen regel  
✅ **Enkelt å bruke**: Visuell dra-og-slipp interface  
✅ **Automatisk håndtering**: Trigger oppdaterer statuser automatisk  
✅ **Manuell kontroll**: Admin kan alltid overstyre med unlock  
✅ **Skalerbart**: Støtter komplekse avhengighetsgrafer  
✅ **Bakoverkompatibel**: Eksisterende kurs settes til `none` (fungerer som før)  
✅ **Type-safe**: Full TypeScript-støtte  
✅ **Optimalisert**: Indekser for rask ytelse  

## Fremtidige forbedringer

### Fase 2 (valgfritt)
- Visuell graf-visning av avhengigheter
- Sirkulær avhengighet-deteksjon
- Batch-operasjoner (sett samme regel for flere kurs)
- Kopier struktur mellom programmer

### Fase 3 (valgfritt)
- Avhengigheter basert på score (må ha 80% på kurs A for å åpne B)
- Tidsbaserte låser (vente X dager mellom kurs)
- Betingede avhengigheter (hvis A fullført, lås opp B, ellers C)

## Support

Ved problemer eller spørsmål:
1. Sjekk at migrasjonen er kjørt korrekt i Supabase
2. Verifiser at alle nye felter finnes i `training_programs` tabellen
3. Sjekk at triggeren `trigger_course_completion_sequence` eksisterer
4. Se browser console for feilmeldinger i frontend

## Changelog

### Versjon 1.0 (2025-11-25)
- ✨ Første fullstendige implementering
- 🗃️ Database-migrasjoner
- 🎨 Struktur-editor med dra-og-slipp
- 🔒 Automatisk låsing/opplåsing
- ✅ Full TypeScript-støtte

