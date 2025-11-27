# Troubleshooting: Kurstildelinger fungerer ikke

## Problem
- Kurs blir opprettet, men tildelinger til brukere/avdelinger fungerer ikke
- Feilmelding: "relation 'training_programs' does not exist" eller lignende
- Dette skjedde etter at Supabase-advarsler ble fikset

## Rask diagnose

### Steg 1: Test funksjonen direkte
Kjør `simple-test-assignment-function.sql` i Supabase SQL Editor.

**Hvis du får feilmelding:**
- Noter ned feilmeldingen nøyaktig
- Gå til Steg 2

**Hvis testen FUNGERER:**
- Problemet er med RLS policies eller frontend-koden
- Gå til Steg 3

### Steg 2: Gjenskape funksjonene
Kjør `recreate-assignment-functions-simple.sql` i Supabase SQL Editor.

Dette vil:
- ✅ Droppe eksisterende funksjoner
- ✅ Gjenskape dem uten SECURITY DEFINER
- ✅ Disable RLS midlertidig
- ✅ Grant permissions

**Test igjen:**
Opprett et nytt kurs og tildel til avdeling.

**Hvis det fortsatt ikke fungerer:**
- Sjekk konsollen i nettleseren (F12) for feilmeldinger
- Se etter RPC-feil eller andre feilmeldinger

### Steg 3: Aktiver RLS igjen (når tildelinger fungerer)

Når tildelinger fungerer uten RLS, kan du aktivere RLS igjen:

```sql
-- 1. Aktiver RLS
ALTER TABLE public.program_assignments ENABLE ROW LEVEL SECURITY;

-- 2. Opprett nødvendige policies
CREATE POLICY "Allow authenticated users to view assignments"
ON public.program_assignments
FOR SELECT
TO authenticated
USING (
  assigned_to_user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'instructor')
  )
);

CREATE POLICY "Allow authenticated users to insert assignments"
ON public.program_assignments
FOR INSERT
TO authenticated
WITH CHECK (true);  -- Enkel policy først, kan strammes inn senere

CREATE POLICY "Allow authenticated users to update assignments"
ON public.program_assignments
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete assignments"
ON public.program_assignments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);
```

### Steg 4: Legg tilbake SECURITY DEFINER (valgfritt)

Hvis du vil ha SECURITY DEFINER tilbake for ekstra sikkerhet:

```sql
-- Gjenskape med SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.assign_program_to_department(...)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
...
$$;

-- Sett riktig owner
ALTER FUNCTION public.assign_program_to_department(...) OWNER TO postgres;
```

## Vanlige feilmeldinger

### "relation 'training_programs' does not exist"
**Årsak:** SECURITY DEFINER funksjonen har feil search_path
**Løsning:** Kjør `recreate-assignment-functions-simple.sql`

### "new row violates row-level security policy"
**Årsak:** RLS blokkerer INSERT
**Løsning:** Disable RLS eller opprett riktige policies

### "permission denied for function assign_program_to_department"
**Årsak:** Manglende GRANT permissions
**Løsning:**
```sql
GRANT EXECUTE ON FUNCTION public.assign_program_to_department(...) TO authenticated;
```

## Alternativ løsning: Fjern RPC-kall helt

Hvis ingenting fungerer, kan du fjerne RPC-kallene og bruke direkte INSERT i frontend-koden.

Frontend-koden i `app/(dashboard)/admin/programs/page.tsx` har allerede en fallback som gjør direkte INSERT. For å tvinge den til å alltid bruke fallback:

```typescript
// I handleSubmit, kommenter ut RPC-kallet:
// const { error: funcError } = await supabase.rpc('assign_program_to_department', {...})

// Og gå rett til fallback-koden:
const dueDate = new Date()
dueDate.setDate(dueDate.getDate() + (formData.deadlineDays || 14))

// Opprett avdelingstildeling direkte
const { error: deptInsertError } = await supabase
  .from('program_assignments')
  .insert({...})
```

Dette vil fungere hvis RLS er disabled eller har riktige policies.

## Kontakt

Hvis ingen av disse løsningene fungerer, trenger vi mer informasjon:
1. Feilmeldingen fra `simple-test-assignment-function.sql`
2. Resultatet fra `diagnose-rls-and-permissions.sql`
3. Eventuelle feilmeldinger fra nettleser-konsollen
