# 🚀 Notifikasjonssystem - Hurtigstart

Dette er en rask guide for å komme i gang med notifikasjonssystemet.

## ✅ Sjekkliste

- [ ] Kjør database migration
- [ ] Sett opp environment variables
- [ ] Test at notifikasjoner fungerer
- [ ] Aktiver browser-notifikasjoner
- [ ] Sett opp cron-job (valgfritt)

## 📋 Steg 1: Database Migration

### Via Supabase Dashboard

1. Gå til [Supabase Dashboard](https://app.supabase.com)
2. Velg prosjektet ditt
3. Klikk på **SQL Editor** i menyen til venstre
4. Klikk **New Query**
5. Kopier innholdet fra `database/migrations/notifications.sql`
6. Lim inn og klikk **Run**
7. Sjekk at du får "Success. No rows returned"

### Via Supabase CLI (alternativ)

```bash
# Installer Supabase CLI hvis du ikke har det
npm install -g supabase

# Logg inn
supabase login

# Link til prosjektet
supabase link --project-ref <your-project-ref>

# Kjør migration
supabase db push database/migrations/notifications.sql
```

## 🔐 Steg 2: Environment Variables

### Lokal Utvikling (`.env.local`)

```env
# Fra Supabase Dashboard -> Settings -> API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Generer en tilfeldig streng for cron-sikkerhet
CRON_SECRET=your-random-secret-string
```

💡 **Tips:** Generer `CRON_SECRET` med:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Vercel Production

1. Gå til Vercel Dashboard
2. Velg prosjektet
3. Gå til **Settings** → **Environment Variables**
4. Legg til:
   - `SUPABASE_SERVICE_ROLE_KEY` (fra Supabase)
   - `CRON_SECRET` (samme som i `.env.local`)

⚠️ **Viktig:** `NEXT_PUBLIC_*` variabler blir automatisk deployert fra Vercel's integration med Supabase.

## 🧪 Steg 3: Test Notifikasjoner

### Test 1: Se om tabellene er opprettet

Gå til Supabase Dashboard → **Table Editor**

Du skal se:
- ✅ `notifications`
- ✅ `notification_preferences`

### Test 2: Opprett en test-notifikasjon

I Supabase Dashboard → **SQL Editor**, kjør:

```sql
-- Erstatt 'YOUR_USER_ID' med en faktisk bruker-ID fra auth.users
INSERT INTO notifications (user_id, type, title, message, link, read)
VALUES (
  'YOUR_USER_ID',
  'system_announcement',
  '🎉 Velkommen!',
  'Notifikasjonssystemet er aktivert',
  '/notifications',
  false
);
```

### Test 3: Sjekk i appen

1. Logg inn som brukeren
2. Se på klokke-ikonet i toppmeny
3. Du skal se en rød badge med "1"
4. Klikk på klokken
5. Varslingen skal vises i dropdown

✅ **Fungerer det?** Gratulerer! Notifikasjonssystemet er aktivert.

## 🔔 Steg 4: Aktiver Browser-Notifikasjoner

### For Brukere

1. Logg inn
2. Gå til **Innstillinger** → **Varslinger**
3. Klikk **Aktiver** under "Nettleservarsler"
4. Godta tillatelsen i nettleseren

### Test Browser-Notifikasjoner

Kjør igjen SQL-kommandoen fra Test 2. Du skal nå få en popup i nettleseren!

💡 **Fungerer ikke?**
- Sjekk at siden kjører på HTTPS eller localhost
- Sjekk nettleserinnstillinger: chrome://settings/content/notifications
- Prøv en annen nettleser

## ⏰ Steg 5: Sett Opp Automatiske Påminnelser (Valgfritt)

Cron-jobben sender automatisk fristpåminnelser hver dag.

### Verifiser Vercel Cron Setup

1. Sjekk at `vercel.json` er committet til git
2. Deploy til Vercel
3. Gå til Vercel Dashboard → **Settings** → **Cron Jobs**
4. Du skal se:
   ```
   Path: /api/cron/deadline-reminders
   Schedule: 0 8 * * * (Daily at 8:00 AM UTC)
   ```

### Test Cron-jobben Manuelt

```bash
# Lokalt (må kjøre dev server)
curl -X GET \
  http://localhost:3000/api/cron/deadline-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Production
curl -X GET \
  https://your-domain.vercel.app/api/cron/deadline-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Forventet respons:**
```json
{
  "success": true,
  "message": "Sent 5 deadline reminders",
  "timestamp": "2025-01-11T08:00:00.000Z"
}
```

### Test Med En Faktisk Frist

1. Gå til admin-panelet
2. Tildel et kurs til en bruker
3. Sett fristen til i morgen
4. Kjør cron-jobben manuelt (curl-kommando over)
5. Sjekk at brukeren får en varsling

## 🐛 Feilsøking

### "Unauthorized" når jeg tester cron-jobben

- Sjekk at `Authorization` header er korrekt
- Sjekk at `CRON_SECRET` matcher i `.env.local` og Vercel

### Notifikasjoner vises ikke i appen

1. Sjekk nettverks-fanen i DevTools
2. Se etter feil i konsollen
3. Verifiser at brukeren er logget inn
4. Sjekk at RLS policies er aktivert (se steg 1)

### Real-time fungerer ikke

1. Gå til Supabase Dashboard → **Database** → **Replication**
2. Aktiver realtime for `notifications` tabellen
3. Refresh siden

### Cron-jobben kjører ikke automatisk

1. Sjekk at `vercel.json` er committet
2. Sjekk Vercel logs: Dashboard → **Deployments** → velg siste → **Functions**
3. Sjekk at environment variables er satt i Vercel

## 📚 Neste Steg

- 📖 Les [full dokumentasjon](./NOTIFICATIONS.md)
- 🎨 Tilpass design/tekster etter behov
- 📧 Sett opp e-post (kommer snart)
- 📊 Se analytics (kommer snart)

## ❓ Trenger du hjelp?

- Sjekk [full dokumentasjon](./NOTIFICATIONS.md)
- Se eksempler i koden: `lib/services/notifications.ts`
- Kontakt: support@opplaeringsportal.no

---

**Sist oppdatert:** 2025-01-11

