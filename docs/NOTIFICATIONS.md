# 🔔 Notifikasjonssystem

Dette dokumentet beskriver notifikasjonssystemet i Opplæringsportalen.

## 📋 Innholdsfortegnelse

- [Funksjoner](#funksjoner)
- [Arkitektur](#arkitektur)
- [Oppsett](#oppsett)
- [Bruk](#bruk)
- [API Referanse](#api-referanse)
- [Database Schema](#database-schema)
- [Automatiske Påminnelser](#automatiske-påminnelser)

## ✨ Funksjoner

### Varslingstyper
- **📚 Kurstildeling** - Varsler når nye kurs blir tildelt
- **⏰ Fristpåminnelser** - Automatiske påminnelser 7, 3 og 1 dag før frist
- **🎉 Fullført kurs** - Gratulasjon når kurs er fullført
- **📢 Systemkunngjøringer** - Viktige meldinger fra administratorer
- **🏆 Prestasjoner** - Oppmuntring og milepæler

### Varslingskanaler
- **Browser-notifikasjoner** - Popup-varsler i nettleseren
- **In-app notifikasjoner** - Varslingsklokke i toppmeny
- **E-post** *(kommer snart)* - Daglig/ukentlig sammendrag

### Brukerinnstillinger
- Slå varslinger av/på for hver kategori
- Velge varslingskanal (browser, e-post)
- Tilpassbare preferanser per bruker

### Real-time
- **Supabase Realtime** - Varslinger vises umiddelbart uten refresh
- **Live oppdateringer** - Teller for uleste oppdateres automatisk
- **Toast-meldinger** - Små popup-meldinger for viktige hendelser

## 🏗️ Arkitektur

### Komponenter

```
components/
├── notifications/
│   └── NotificationDropdown.tsx    # Dropdown med varslinger
└── shared/
    └── Topbar.tsx                   # Integrert varslingsklokke

app/(dashboard)/
├── notifications/
│   └── page.tsx                     # Side for alle varslinger
└── settings/
    └── notifications/
        └── page.tsx                 # Innstillinger

lib/
└── services/
    └── notifications.ts             # Backend-logikk og API

app/api/
└── cron/
    └── deadline-reminders/
        └── route.ts                 # Automatisk fristpåminnelser
```

### Database Tabeller

**notifications**
- Lagrer alle varslinger
- Knyttet til bruker via `user_id`
- Metadata i JSONB for fleksibilitet

**notification_preferences**
- Brukerinnstillinger per varslingskategori
- Standard verdier for nye brukere

## 🚀 Oppsett

### 1. Database Setup

Kjør SQL-migrasjonen:

```bash
# Logg inn på Supabase Dashboard
# Gå til SQL Editor
# Kjør innholdet fra: database/migrations/notifications.sql
```

Eller via Supabase CLI:

```bash
supabase db push database/migrations/notifications.sql
```

### 2. Environment Variables

Legg til i `.env.local`:

```env
# For cron-job sikkerhet
CRON_SECRET=din_hemmelige_nøkkel_her

# For admin-operasjoner (fra Supabase Dashboard -> Settings -> API)
SUPABASE_SERVICE_ROLE_KEY=din_service_role_key_her
```

### 3. Vercel Cron Setup (for automatiske påminnelser)

Opprett `vercel.json` i prosjektets rot:

```json
{
  "crons": [
    {
      "path": "/api/cron/deadline-reminders",
      "schedule": "0 8 * * *"
    }
  ]
}
```

Dette kjører påminnelser hver dag kl. 08:00 UTC (09:00 norsk vintertid, 10:00 sommertid).

### 4. Browser Notification Permission

Brukere må gi tillatelse første gang:

```typescript
import { requestNotificationPermission } from '@/lib/services/notifications'

// Be om tillatelse
const permission = await requestNotificationPermission()

if (permission === 'granted') {
  console.log('Nettleservarsler aktivert!')
}
```

## 📖 Bruk

### Opprette Varslinger

#### Enkel varsling

```typescript
import { createNotification } from '@/lib/services/notifications'

await createNotification({
  userId: 'user-uuid',
  type: 'assignment_created',
  title: '📚 Nytt kurs tildelt',
  message: 'Du har fått tildelt "Sikkerhetskurs"',
  link: '/programs/program-uuid',
  metadata: {
    programId: 'program-uuid',
    deadlineDays: 14
  }
})
```

#### Bulk varslinger (mange brukere)

```typescript
import { createBulkNotifications } from '@/lib/services/notifications'

const userIds = ['user-1', 'user-2', 'user-3']

await createBulkNotifications(userIds, {
  type: 'system_announcement',
  title: '📢 Viktig melding',
  message: 'Systemet vil være nede for vedlikehold i morgen',
  link: '/announcements/123'
})
```

#### Helper-funksjoner

```typescript
import { 
  createDeadlineReminder,
  notifyNewAssignment,
  notifyCourseCompleted 
} from '@/lib/services/notifications'

// Fristpåminnelse
await createDeadlineReminder(userId, 'Sikkerhetskurs', 3, programId)

// Ny tildeling
await notifyNewAssignment(userId, 'Sikkerhetskurs', 14, programId)

// Fullført kurs
await notifyCourseCompleted(userId, 'Sikkerhetskurs', programId)
```

### Hente Varslinger

```typescript
import { getNotifications, getUnreadCount } from '@/lib/services/notifications'

// Hent siste 20 varslinger
const notifications = await getNotifications(userId, 20)

// Hent antall uleste
const count = await getUnreadCount(userId)
```

### Markere Som Lest

```typescript
import { markAsRead, markAllAsRead } from '@/lib/services/notifications'

// Enkelt varsling
await markAsRead('notification-uuid')

// Flere varslinger
await markAsRead(['uuid-1', 'uuid-2'])

// Alle varslinger for bruker
await markAllAsRead(userId)
```

### Slette Varslinger

```typescript
import { deleteNotification } from '@/lib/services/notifications'

await deleteNotification('notification-uuid')
// eller
await deleteNotification(['uuid-1', 'uuid-2'])
```

### Real-time Subscription

```typescript
import { subscribeToNotifications } from '@/lib/services/notifications'

const unsubscribe = subscribeToNotifications(userId, (newNotification) => {
  console.log('Ny varsling mottatt!', newNotification)
  // Oppdater UI, vis toast, etc.
})

// Cleanup når komponenten unmountes
return () => unsubscribe()
```

## 🔧 API Referanse

### NotificationService

```typescript
// Types
type NotificationType = 
  | 'assignment_created' 
  | 'deadline_reminder' 
  | 'course_completed'
  | 'course_updated'
  | 'comment_reply'
  | 'achievement_unlocked'
  | 'system_announcement'

interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  link: string | null
  read: boolean
  created_at: string
  metadata?: Record<string, unknown>
}

// Functions
createNotification(params: CreateNotificationParams): Promise<Notification>
createBulkNotifications(userIds: string[], notification): Promise<Notification[]>
markAsRead(notificationIds: string | string[]): Promise<void>
markAllAsRead(userId: string): Promise<void>
deleteNotification(notificationIds: string | string[]): Promise<void>
getUnreadCount(userId: string): Promise<number>
getNotifications(userId: string, limit?: number): Promise<Notification[]>
subscribeToNotifications(userId: string, callback): () => void
requestNotificationPermission(): Promise<NotificationPermission>
showBrowserNotification(title: string, options?): Notification | undefined
```

## 🗄️ Database Schema

### `notifications`

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key til auth.users |
| type | TEXT | Varslingstype (enum) |
| title | TEXT | Tittel på varsling |
| message | TEXT | Hovedinnhold |
| link | TEXT | Valgfri lenke (e.g. `/programs/123`) |
| read | BOOLEAN | Om varslingen er lest |
| metadata | JSONB | Ekstra data (fleksibelt) |
| created_at | TIMESTAMPTZ | Opprettet tidspunkt |
| updated_at | TIMESTAMPTZ | Sist oppdatert |

### `notification_preferences`

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key til auth.users (unique) |
| browser_notifications | BOOLEAN | Tillat browser-varsler |
| email_notifications | BOOLEAN | Tillat e-post |
| deadline_reminders | BOOLEAN | Fristpåminnelser |
| course_updates | BOOLEAN | Kursoppdateringer |
| achievements | BOOLEAN | Prestasjoner |
| system_announcements | BOOLEAN | Systemkunngjøringer |
| created_at | TIMESTAMPTZ | Opprettet tidspunkt |
| updated_at | TIMESTAMPTZ | Sist oppdatert |

### Indexes

For optimal ytelse:
- `idx_notifications_user_id` - Rask filtrering per bruker
- `idx_notifications_read` - Rask telling av uleste
- `idx_notifications_user_read` - Kombinert index
- `idx_notifications_created_at` - Sortering

## ⏰ Automatiske Påminnelser

### Cron Job

Endpoint: `/api/cron/deadline-reminders`  
Schedule: Hver dag kl. 08:00 UTC  
Autentisering: Bearer token (CRON_SECRET)

### Funksjonalitet

1. **7-dagers påminnelse** - "🔵 Du har 7 dager igjen"
2. **3-dagers påminnelse** - "🟡 Du har 3 dager igjen"
3. **1-dagers påminnelse** - "🔴 Du har 1 dag igjen"
4. **Overfrist** - "🚨 Fristen har gått ut"

### Logikk

- Finner alle aktive tildelinger (`user_programs`)
- Matcher frister mot dagens dato + 7/3/1 dag
- Sjekker brukerpreferanser (`deadline_reminders`)
- Oppretter varslinger
- *Fremtidig:* Sender e-post hvis aktivert

### Manuell Testing

```bash
curl -X GET \
  https://your-domain.vercel.app/api/cron/deadline-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## 🎨 UI Komponenter

### NotificationDropdown

Dropdown i toppmeny med:
- Teller for uleste (rød badge)
- Liste over siste 20 varslinger
- "Merk alle som lest" knapp
- Lenke til full varslingside
- Real-time oppdateringer

### Notifications Page

Full side med:
- Filter: "Alle" / "Uleste"
- Kort for hver varsling med ikon
- Slett-knapp per varsling
- Merk enkelt/alle som lest
- Responsivt design

### Notification Settings Page

Innstillinger for:
- Browser-notifikasjoner (be om tillatelse)
- E-post (kommer snart)
- Toggles per kategori
- Lagre-knapp

## 🔒 Sikkerhet

### Row Level Security (RLS)

Alle tabeller har RLS aktivert:

- **Brukere** kan kun se, oppdatere og slette egne varslinger
- **Admins** kan opprette varslinger for andre
- **Service Role** (cron) kan opprette varslinger for alle

### CRON_SECRET

Cron-jobben krever autentisering:

```typescript
const authHeader = request.headers.get('authorization')
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return new NextResponse('Unauthorized', { status: 401 })
}
```

## 🧪 Testing

### Manuell Testing

1. **Opprett varsling**:
   - Tildel et nytt kurs til en bruker
   - Sjekk at varslingen vises i dropdown
   - Sjekk at telleren øker

2. **Merk som lest**:
   - Klikk på en ulest varsling
   - Sjekk at bakgrunnen endrer seg
   - Sjekk at telleren reduseres

3. **Real-time**:
   - Åpne to vinduer med samme bruker
   - Opprett varsling i Supabase Dashboard direkte
   - Sjekk at den vises umiddelbart i begge vinduer

4. **Browser-notifikasjoner**:
   - Gå til innstillinger og aktiver
   - Opprett en varsling
   - Sjekk at popup vises

5. **Cron-job**:
   - Sett en frist til i morgen
   - Vent til neste dag
   - Sjekk at påminnelse er opprettet

### Unit Tests *(fremtidig)*

```typescript
// Example with Jest
describe('Notification Service', () => {
  it('should create notification', async () => {
    const notification = await createNotification({
      userId: 'test-user',
      type: 'assignment_created',
      title: 'Test',
      message: 'Test message'
    })
    expect(notification.id).toBeDefined()
  })
})
```

## 🐛 Feilsøking

### Varslinger vises ikke

1. Sjekk at tabellene er opprettet (SQL migration)
2. Sjekk RLS policies i Supabase Dashboard
3. Sjekk nettverksfanen i DevTools for feil

### Real-time fungerer ikke

1. Sjekk at Supabase Realtime er aktivert for `notifications` tabellen
2. Sjekk at `subscribeToNotifications` blir kalt riktig
3. Sjekk at `unsubscribe` kalles ved cleanup

### Browser-notifikasjoner vises ikke

1. Sjekk at tillatelse er gitt (chrome://settings/content/notifications)
2. Sjekk at siden kjører på HTTPS eller localhost
3. Sjekk konsollen for feil

### Cron-job kjører ikke

1. Sjekk at `vercel.json` er committet
2. Sjekk Vercel Dashboard -> Settings -> Cron Jobs
3. Sjekk at `CRON_SECRET` er satt i Vercel Environment Variables
4. Sjekk logs i Vercel Dashboard

## 📈 Fremtidige Forbedringer

- [ ] E-post-notifikasjoner via Resend/SendGrid
- [ ] Push-notifikasjoner til mobil (PWA)
- [ ] Notifikasjonshistorikk med søk
- [ ] Gruppert visning (e.g. "5 nye frister i dag")
- [ ] Snooze-funksjon
- [ ] Merk som favoritt
- [ ] Eksporter varslinger til CSV
- [ ] Analytics dashboard for admins
- [ ] Custom notifikasjonsikoner per type
- [ ] Lyd-varsler

## 📚 Ressurser

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Web Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

**Opprettet:** 2025-01-11  
**Versjon:** 1.0.0  
**Kontakt:** support@opplaeringsportal.no

