# Sikkerhetsgjennomgang

Dette dokumentet beskriver sikkerhetstiltak som er implementert i opplæringsportalen.

## Autentisering og autorisering

### Middleware-beskyttelse
- ✅ Alle beskyttede routes krever autentisering (`/dashboard`, `/admin`, `/instructor`, `/my-learning`, `/programs`)
- ✅ Admin-routes (`/admin/*`) krever `role = 'admin'` i `profiles`-tabellen
- ✅ Instructor-routes (`/instructor/*`) krever at brukeren er instruktør for minst ett kurs
- ✅ Uautentiserte brukere redirectes til `/login`

### Server-side sjekker
- ✅ Alle admin-sider sjekker rolle server-side før data hentes
- ✅ Alle client-side admin-sider sjekker rolle og redirecter hvis ikke admin
- ✅ Instructor-sider sjekker at brukeren faktisk er instruktør for kursene de prøver å se

### Row Level Security (RLS)
- ✅ Alle tabeller har RLS aktivert
- ✅ Policies sørger for at brukere kun kan se data fra sitt eget selskap (`company_id`)
- ✅ Policies sørger for at brukere kun kan oppdatere sine egne data
- ✅ Admins kan se og administrere all data i sitt selskap
- ✅ Instructors kan se og oppdatere data for kurs de er instruktør for

## Dataisolasjon

### Company isolation
- ✅ Alle queries filtrerer på `company_id` fra brukerens profil
- ✅ RLS policies på database-nivå sikrer at brukere ikke kan se data fra andre selskaper
- ✅ Server-side sjekker validerer `company_id` før data hentes

### Program access control
- ✅ Brukere kan kun se programmer de er tildelt via `program_assignments`
- ✅ Status-sjekk: `locked` og `pending` programmer er ikke tilgjengelige
- ✅ Sjekk på `company_id` når program hentes

## Input-validering

### Client-side validering
- ✅ Form-validering på alle input-felter
- ✅ E-post-validering ved registrering
- ✅ Passord-krav ved opprettelse
- ✅ Organisasjonsnummer-validering

### Server-side sikkerhet
- ✅ Supabase håndterer SQL injection-beskyttelse via parameteriserte queries
- ✅ RLS policies på database-nivå gir ekstra beskyttelse
- ✅ All data valideres mot database-schema

## XSS-beskyttelse

### HTML-innhold
- ⚠️ `dangerouslySetInnerHTML` brukes for å vise HTML-innhold fra TinyMCE editor
- ✅ Kun admin-brukere kan legge inn HTML-innhold
- ⚠️ **Anbefaling**: Vurder å implementere HTML-sanitization (f.eks. DOMPurify) for ekstra sikkerhet

### Content Security Policy
- ⚠️ **Anbefaling**: Vurder å implementere CSP headers for ekstra beskyttelse mot XSS

## API-sikkerhet

### Auth callback
- ✅ Hardcoded secrets fjernet (krever nå environment variables)
- ✅ Feilhåndtering implementert

### Cron jobs
- ✅ `CRON_SECRET` kreves for å kjøre cron jobs
- ✅ Service role key brukes kun for admin-operasjoner

## Session management

### Session-håndtering
- ✅ Supabase håndterer session management
- ✅ Cookies er HttpOnly og Secure (håndteres av Supabase)
- ✅ Session refresh håndteres automatisk

## Anbefalte forbedringer

### Høy prioritet
1. **HTML-sanitization**: Implementer DOMPurify eller lignende for å sanitize HTML-innhold før det vises
2. **Content Security Policy**: Legg til CSP headers for ekstra XSS-beskyttelse
3. **Rate limiting**: Implementer rate limiting på API-routes og login-endepunkter

### Medium prioritet
1. **Audit logging**: Logg alle admin-operasjoner for sporing
2. **Two-factor authentication**: Vurder 2FA for admin-brukere
3. **Password policy**: Styrk passord-krav (lengde, kompleksitet)

### Lav prioritet
1. **Security headers**: Legg til flere security headers (X-Frame-Options, X-Content-Type-Options, etc.)
2. **Input length limits**: Sett maksimal lengde på alle input-felter
3. **File upload validation**: Valider filtyper og størrelse for opplastinger

## Testing

### Sikkerhetstesting
- ✅ Test at ikke-admin brukere ikke kan aksessere admin-routes
- ✅ Test at brukere ikke kan se data fra andre selskaper
- ✅ Test at brukere ikke kan aksessere låste/pending programmer

### Anbefalte tester
- ⚠️ Penetrasjonstesting av autentisering og autorisering
- ⚠️ SQL injection testing (selv om Supabase håndterer dette)
- ⚠️ XSS testing av HTML-innhold

## Oppdateringer

Dette dokumentet bør oppdateres når nye sikkerhetstiltak implementeres eller når sårbarheter oppdages.

