# Opplæringsportal - Learning Portal

En komplett opplæringsportal bygget med Next.js 14, TypeScript, Supabase og Tailwind CSS.

## 🚀 Kom i gang

### 1. Installer avhengigheter
```bash
npm install
```

### 2. Sett opp miljøvariabler
Opprett en `.env.local` fil i rotmappen med følgende innhold:

```
NEXT_PUBLIC_SUPABASE_URL=https://njumqvxjaktxicxwucki.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qdW1xdnhqYWt0eGljeHd1Y2tpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NDgwNzgsImV4cCI6MjA3NzEyNDA3OH0.XAiL_r-4cXWys7UcJdMmtcnnMwq5vNGlECAIVdaUKs4
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 3. Sett opp database

**VIKTIG:** Du må opprette database-skjemaet i Supabase før du kan bruke applikasjonen.

Gå til [Supabase Dashboard](https://supabase.com/dashboard) → ditt prosjekt → SQL Editor og kjør følgende SQL-kommandoer:

#### Steg 1: Opprett tabeller
```sql
-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  badge_system_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Departments
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'instructor', 'user')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training Programs
CREATE TABLE training_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  is_mandatory BOOLEAN DEFAULT false,
  instructor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  deadline DATE,
  repetition_enabled BOOLEAN DEFAULT false,
  repetition_interval_months INTEGER,
  badge_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Program Departments (many-to-many)
CREATE TABLE program_departments (
  program_id UUID REFERENCES training_programs(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY (program_id, department_id)
);

-- Modules
CREATE TABLE modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID REFERENCES training_programs(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('video', 'document', 'quiz', 'interactive')),
  content JSONB NOT NULL DEFAULT '{}',
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Progress
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  program_id UUID REFERENCES training_programs(id) ON DELETE CASCADE NOT NULL,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(50) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  time_spent_minutes INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  score DECIMAL(5,2),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module_id)
);

-- Badges
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  program_id UUID REFERENCES training_programs(id) ON DELETE CASCADE NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, program_id)
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reminders
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  program_id UUID REFERENCES training_programs(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(50) CHECK (type IN ('deadline', 'repetition')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Steg 2: Opprett indekser
```sql
CREATE INDEX idx_departments_company ON departments(company_id);
CREATE INDEX idx_profiles_company ON profiles(company_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_programs_company ON training_programs(company_id);
CREATE INDEX idx_programs_instructor ON training_programs(instructor_id);
CREATE INDEX idx_modules_program ON modules(program_id);
CREATE INDEX idx_progress_user ON user_progress(user_id);
CREATE INDEX idx_progress_program ON user_progress(program_id);
CREATE INDEX idx_badges_user ON badges(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_reminders_scheduled ON reminders(scheduled_for, sent);
```

#### Steg 3: Aktiver Row Level Security (RLS)
```sql
-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users view company profiles" ON profiles FOR SELECT 
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins manage profiles" ON profiles FOR ALL 
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Companies policies
CREATE POLICY "Users view own company" ON companies FOR SELECT 
  USING (id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins update company" ON companies FOR UPDATE 
  USING (id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Departments policies
CREATE POLICY "Users view company departments" ON departments FOR SELECT 
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins manage departments" ON departments FOR ALL 
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Training programs policies
CREATE POLICY "Users view company programs" ON training_programs FOR SELECT 
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins manage all programs" ON training_programs FOR ALL 
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Instructors manage own programs" ON training_programs FOR ALL 
  USING (instructor_id = auth.uid());

-- Modules policies
CREATE POLICY "Users view program modules" ON modules FOR SELECT 
  USING (program_id IN (SELECT id FROM training_programs WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "Admins and instructors manage modules" ON modules FOR ALL 
  USING (program_id IN (SELECT id FROM training_programs WHERE instructor_id = auth.uid() OR company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin')));

-- User progress policies
CREATE POLICY "Users view own progress" ON user_progress FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users manage own progress" ON user_progress FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admins view company progress" ON user_progress FOR SELECT 
  USING (user_id IN (SELECT id FROM profiles WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin')));
CREATE POLICY "Instructors view program progress" ON user_progress FOR SELECT 
  USING (program_id IN (SELECT id FROM training_programs WHERE instructor_id = auth.uid()));

-- Badges policies
CREATE POLICY "Users view own badges" ON badges FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System insert badges" ON badges FOR INSERT WITH CHECK (true);

-- Notifications policies
CREATE POLICY "Users view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System insert notifications" ON notifications FOR INSERT WITH CHECK (true);

-- Reminders policies
CREATE POLICY "Users view own reminders" ON reminders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System manage reminders" ON reminders FOR ALL USING (true);
```

#### Steg 4: Opprett Storage Buckets
```sql
-- Create buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('company-logos', 'company-logos', true),
  ('avatars', 'avatars', true),
  ('training-documents', 'training-documents', false),
  ('training-videos', 'training-videos', false);

-- Storage policies
CREATE POLICY "Public view logos" ON storage.objects FOR SELECT USING (bucket_id = 'company-logos');
CREATE POLICY "Admins upload logos" ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'company-logos' AND auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

CREATE POLICY "Users view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users view documents" ON storage.objects FOR SELECT 
  USING (bucket_id = 'training-documents' AND auth.uid() IN (SELECT id FROM profiles));
CREATE POLICY "Instructors upload documents" ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'training-documents' AND auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'instructor')));

CREATE POLICY "Users view videos" ON storage.objects FOR SELECT 
  USING (bucket_id = 'training-videos' AND auth.uid() IN (SELECT id FROM profiles));
CREATE POLICY "Instructors upload videos" ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'training-videos' AND auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'instructor')));
```

### 4. Start utviklingsserveren
```bash
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000) i nettleseren din.

## 📚 Bruksanvisning

### Første gangs oppsett

1. **Opprett bedriftskonto**: Gå til `/signup` for å opprette din bedrift og bli den første administratoren
2. **Logg inn**: Bruk `/login` for å logge inn
3. **Opprett avdelinger**: Som admin, gå til "Avdelinger" for å organisere bedriften
4. **Inviter brukere**: Gå til "Brukere" for å legge til ansatte i systemet
5. **Opprett opplæringsprogrammer**: Begynn å lage opplæringsinnhold

### Roller

- **Administrator**: Full tilgang til alle funksjoner
- **Instruktør**: Kan lage og administrere egne opplæringsprogrammer  
- **Bruker**: Kan gjennomføre tildelt opplæring

## 🏗️ Prosjektstruktur

```
/app
  /(auth)           # Autentisering (login/signup)
  /(dashboard)      # Hovedapplikasjon
    /admin          # Admin-sider
    /instructor     # Instruktør-sider
    /my-learning    # Bruker-sider
  /api             # API-ruter
/components
  /ui              # UI-komponenter
  /shared          # Delte komponenter
/lib
  /supabase        # Supabase-konfigurering
  /utils           # Hjelpefunksjoner
/types             # TypeScript-typer
```

## 🎯 Funksjoner implementert

### ✅ Ferdig
- ✅ Autentisering (registrering/pålogging)
- ✅ Rollebasert tilgangskontroll  
- ✅ Dashboard for alle roller
- ✅ Avdelingsstyring (admin)
- ✅ Brukerstyring (admin)
- ✅ Min opplæring (brukere)
- ✅ Responsiv design
- ✅ Database-skjema med RLS

### 🚧 Under utvikling
- 🚧 Opplæringsprogrammer (CRUD)
- 🚧 Moduler (video, dokument, quiz, interaktiv)
- 🚧 Fremdriftssporing
- 🚧 Badge-system

### 📋 Planlagt
- 📋 Instructor-dashboard
- 📋 Rapporter og eksport
- 📋 E-postvarsling
- 📋 Automatiske påminnelser
- 📋 Fileopplasting
- 📋 Avanserte quiz-funksjoner

## 🚀 Deployment til Vercel

1. Push koden til GitHub
2. Importer prosjektet i [Vercel](https://vercel.com)
3. Legg til miljøvariabler:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (for server-side operasjoner)

## 🔧 Teknisk stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Autentisering**: Supabase Auth
- **Icons**: Lucide React
- **Notifications**: Sonner
- **Forms**: React Hook Form + Zod

## 📄 Lisens

Dette prosjektet er laget for opplæringsformål.