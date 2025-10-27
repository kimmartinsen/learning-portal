# 🎯 Implementeringsplan: Tema-hierarki og individuelle tildelinger

## 📋 Oversikt over endringer

### Nåværende struktur (problemer):
- ❌ Programmer ligger direkte under bedrift (uorganisert)
- ❌ Kun avdelingsbaserte tildelinger (ikke fleksibelt)
- ❌ Globale frister på programnivå (ikke individuelt)
- ❌ Begrenset kontroll over hvem som får hvilke opplæringer

### Ny struktur (forbedringer):
- ✅ **Tema-hierarki**: Bedrift → Tema → Programmer
- ✅ **Individuelle tildelinger** med personlige frister (f.eks. 14 dager)
- ✅ **Fleksible tildelinger**: Enkeltbruker, avdeling, eller bulk
- ✅ **Automatisk frist-håndtering** og påminnelser
- ✅ **Bedre oversikt** for både admin og brukere

## 🗄️ Database-migrering (Fase 1)

### Nye tabeller:
1. **`themes`** - Øverste nivå (HMS, IT-sikkerhet, etc.)
2. **`program_assignments`** - Erstatter `program_departments`
3. **Views** - For enkle queries (`user_assignments`, `assignment_overview`)

### Modifiserte tabeller:
- **`training_programs`**: Legg til `theme_id`, fjern `deadline` og `is_mandatory`
- **`user_progress`**: Legg til `assignment_id`

### Automatiske funksjoner:
- Auto-tildeling når bruker blir lagt til avdeling
- Auto-oppdatering av assignment-status basert på progresjon

## 🎨 UI/UX Endringer (Fase 2)

### 1. Admin-sider som må endres:

**`/admin/themes` (NY)**
- Oversikt over alle temaer med hierarkisk visning
- CRUD for temaer (navn, beskrivelse, farge, ikon)
- Drag-and-drop for sortering

**`/admin/programs` (OPPDATER)**
- Gruppér programmer under temaer
- Endre til tema-basert oppretting
- Fjern globale frister/krav

**`/admin/assignments` (NY)**
- Nytt tildelingssystem med individuelle frister
- Bulk-tildeling til flere brukere
- Oversikt over alle aktive tildelinger
- Frist-håndtering og påminnelser

### 2. Bruker-sider som må endres:

**`/my-learning` (FORBEDRE)**
- Vis personlige frister og dager igjen
- Gruppér etter tema med farger
- Fremhev forsinkede/kritiske tildelinger
- Bedre fremdriftsindikatorer

### 3. Dashboard-forbedringer:

**Admin Dashboard:**
- Statistikk over tildelinger og fullføring
- Varsler om forsinkede tildelinger
- Kommende frister (neste 7/14 dager)

**Bruker Dashboard:**
- Personlig fremdrift med frister
- Temabasert organisering
- Prioritert liste (forfaller snart)

## 🔄 Implementeringsplan (trinnvis)

### **Fase 1: Database og Backend (Uke 1-2)**
```sql
-- 1. Kjør database-migrering (se database-migrations/themes-and-assignments.sql)
-- 2. Oppdater TypeScript-typer (se types/enhanced-database.types.ts)
-- 3. Lag nye API-endepunkter for:
--    - Tema CRUD
--    - Assignment CRUD
--    - Bulk-operasjoner
```

### **Fase 2: Admin UI (Uke 3-4)**
```typescript
// 1. Opprett /admin/themes
//    - ThemeListPage.tsx
//    - ThemeFormModal.tsx
//    - Drag-and-drop sortering

// 2. Oppdater /admin/programs  
//    - Gruppér under temaer
//    - Fjern globale frister
//    - Tema-selector i form

// 3. Opprett /admin/assignments
//    - AssignmentModal.tsx (individuelle tildelinger)
//    - BulkAssignmentModal.tsx
//    - AssignmentOverview.tsx
```

### **Fase 3: Bruker UI (Uke 5)**
```typescript
// 1. Oppdater /my-learning
//    - Tema-gruppering med farger
//    - Personlige frister og countdown
//    - Prioritert sortering (forfaller snart først)

// 2. Forbedre dashboards
//    - PersonalizedDashboard.tsx
//    - AdminAssignmentDashboard.tsx
```

### **Fase 4: Automatisering og varsling (Uke 6)**
```typescript
// 1. Påminnelse-system
//    - Email-templates for frister
//    - Cron jobs for varsling
//    - Push-notifications

// 2. Auto-assignment logikk
//    - Når bruker legges til avdeling
//    - Bulk-import av brukere

// 3. Rapporter og analytics
//    - Fullføringsrater per tema
//    - Forsinkelse-rapporter
//    - Eksport-funksjonalitet
```

## 📊 Eksempel på dataflyt

### 1. Admin oppretter tema:
```json
{
  "name": "HMS og Sikkerhet",
  "description": "Helse, miljø og sikkerhet",
  "color": "#dc2626",
  "icon": "Shield"
}
```

### 2. Admin tildeler program:
```json
{
  "program_id": "prog-123",
  "assigned_to_user_id": "user-456", 
  "due_date": "2024-02-15T23:59:59Z", // 14 dager fra nå
  "is_mandatory": true,
  "max_attempts": 3,
  "notes": "Påkrevd grunnet nye HMS-forskrifter"
}
```

### 3. Bruker ser tildeling:
```json
{
  "program_title": "Brannvern og evakuering",
  "theme_name": "HMS og Sikkerhet",
  "theme_color": "#dc2626",
  "days_remaining": 12,
  "calculated_status": "not_started",
  "progress_percentage": 0
}
```

## 🧪 Testing-plan

### Database-testing:
- [ ] Migrasjon kjører uten feil
- [ ] RLS-policies fungerer korrekt
- [ ] Views returnerer riktige data
- [ ] Triggers oppdaterer status automatisk

### API-testing:
- [ ] CRUD-operasjoner for temaer
- [ ] Assignment-operasjoner (enkelt + bulk)
- [ ] Filtreringer og søk fungerer
- [ ] Autorisasjon respekteres

### UI-testing:
- [ ] Responsive design på alle skjermstørrelser
- [ ] Tema-farger vises korrekt
- [ ] Frister og countdown fungerer
- [ ] Bulk-operasjoner har god UX

## 🚀 Fordeler med ny struktur

### For administratorer:
- **Bedre organisering**: Temaer gir logisk gruppering
- **Granular kontroll**: Individuelle tildelinger og frister
- **Automatisering**: Auto-assignment og påminnelser
- **Oversikt**: Dashboard med kritiske frister

### For brukere:
- **Klarhet**: Personlige frister og prioritering
- **Motivasjon**: Temabasert progresjon og farger
- **Fleksibilitet**: Kan jobbe i sitt eget tempo (innenfor frist)

### For systemet:
- **Skalerbarhet**: Hierarkisk struktur støtter vekst
- **Fleksibilitet**: Støtter ulike opplæringsmodeller
- **Datakvalitet**: Bedre sporing og rapportering
- **Brukeropplevelse**: Mer intuitiv og organisert

## 🎯 Suksesskriterier

- [ ] Alle eksisterende programmer kan migreres til temaer
- [ ] Admins kan tildele opplæring med 14-dagers frister
- [ ] Brukere ser personlige frister og kan prioritere
- [ ] Automatiske påminnelser sendes 3 dager før frist
- [ ] System støtter 100+ samtidige tildelinger uten ytelsestap
- [ ] Mobile-vennlig design på alle nye sider

---

**Konklusjon**: Dette er en betydelig forbedring som gjør systemet mer fleksibelt, brukervennlig og profesjonelt. Den hierarkiske strukturen med individuelle tildelinger løser mange av begrensningene i dagens system.
