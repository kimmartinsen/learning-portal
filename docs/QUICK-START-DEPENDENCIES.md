# 🚀 Quick Start: Fleksible Program-avhengigheter

## Steg 1: Kjør database-migrasjoner

1. Gå til **Supabase Dashboard** → **SQL Editor**
2. Åpne filen: `docs/database-migrations/APPLY-ALL-MIGRATIONS.sql`
3. Kopier innholdet og lim inn i SQL Editor
4. Klikk **Run**
5. Verifiser at alle steg fullføres uten feil

## Steg 2: Test i applikasjonen

### A) Opprett et program

1. Gå til **Kursadministrasjon** (`/admin/programs`)
2. Klikk **"Nytt program"**
3. Fyll inn navn og beskrivelse
4. Velg progression type (kan være hva som helst nå)
5. Klikk **"Opprett program"**

### B) Legg til kurs i programmet

1. Klikk **"Nytt kurs"**
2. Fyll inn kursinformasjon
3. Velg programmet du nettopp opprettet
4. Sett en **Rekkefølge** (f.eks. 0, 1, 2...)
5. Klikk **"Opprett kurs"**
6. Gjenta for flere kurs

### C) Konfigurer avhengigheter

1. Finn programmet i listen
2. Klikk **"Struktur"** knappen (ikon: nettverk)
3. Du ser nå alle kursene i programmet
4. **Dra kursene** for å endre rekkefølgen hvis nødvendig
5. For hvert kurs, velg avhengighetstype:
   - **Tilgjengelig umiddelbart**: Alltid åpent
   - **Åpnes automatisk etter forrige**: Auto-unlock når forrige er ferdig
   - **Krever godkjenning etter forrige**: Admin må godkjenne
   - **Avhenger av spesifikke kurs**: Velg hvilke kurs som må fullføres
6. Klikk **"Lagre endringer"**

### D) Tildel programmet

1. Gå tilbake til Kursadministrasjon
2. Klikk **"Tildel program"** ved programmet
3. Velg avdeling(er) eller bruker(e)
4. Klikk **"Lagre tildelinger"**

### E) Test som bruker

1. Logg inn som en bruker som har fått programmet tildelt
2. Gå til **Min opplæring** (`/my-learning`)
3. Du vil se:
   - ✅ Første kurs er tilgjengelig (hvis satt til `none` eller første i sekvens)
   - 🔒 Senere kurs er låst
4. Fullfør første kurs
5. Gå tilbake til Min opplæring
6. Neste kurs er nå:
   - ✅ Tilgjengelig (hvis `previous_auto`)
   - ⏸️ Venter på godkjenning (hvis `previous_manual`)
   - 🔒 Fortsatt låst (hvis det avhenger av flere kurs)

### F) Godkjenn pending kurs (hvis nødvendig)

1. Som admin, gå til **Oversikt** (`/admin/themes`)
2. Finn programmet og brukeren
3. Se kurset med status "Venter på godkjenning"
4. Klikk **"Lås opp"**
5. Kurset er nå tilgjengelig for brukeren

## Eksempel: Enkelt lineært program

```
Program: "Grunnkurs Sikkerhet"

Kurs 1: Introduksjon
  → Avhengighet: Tilgjengelig umiddelbart

Kurs 2: Teori
  → Avhengighet: Åpnes automatisk etter forrige

Kurs 3: Praktisk øvelse
  → Avhengighet: Krever godkjenning etter forrige

Kurs 4: Eksamen
  → Avhengighet: Åpnes automatisk etter forrige
```

**Flyt:**
1. Bruker ser kun Kurs 1
2. Fullfører Kurs 1 → Kurs 2 åpnes automatisk
3. Fullfører Kurs 2 → Kurs 3 venter på admin
4. Admin godkjenner → Kurs 3 åpnes
5. Fullfører Kurs 3 → Kurs 4 åpnes automatisk

## Eksempel: Program med parallelle spor

```
Program: "Komplett Salgstrening"

Kurs 1: Intro til salg
  → Avhengighet: Tilgjengelig umiddelbart

Kurs 2: Produktkunnskap
  → Avhengighet: Åpnes automatisk etter forrige (etter Intro)

Kurs 3: Kundebehandling
  → Avhengighet: Åpnes automatisk etter forrige (etter Intro)

Kurs 4: Avansert salgsteknikk
  → Avhengighet: Avhenger av spesifikke kurs → [Produktkunnskap, Kundebehandling]
```

**Flyt:**
1. Bruker ser kun Kurs 1
2. Fullfører Kurs 1 → Kurs 2 og 3 åpnes samtidig
3. Bruker kan velge å ta Kurs 2 eller 3 først
4. Kurs 4 forblir låst til BEGGE er fullført
5. Når begge er fullført → Kurs 4 åpnes automatisk

## Vanlige spørsmål

**Q: Kan jeg endre avhengigheter etter at programmet er tildelt?**  
A: Ja! Endringer trer i kraft umiddelbart. Triggeren re-evaluerer statuser når kurs fullføres.

**Q: Hva skjer hvis jeg endrer rekkefølgen?**  
A: Rekkefølgen lagres i `sort_order` feltet. Dette påvirker `previous_auto` og `previous_manual` avhengigheter.

**Q: Kan et kurs avhenge av flere andre kurs?**  
A: Ja, bruk `specific_courses` og velg flere kurs. Alle må fullføres før kurset åpnes.

**Q: Kan jeg lage sirkler (A avhenger av B, B avhenger av A)?**  
A: Teknisk mulig, men ikke anbefalt. Systemet har ikke innebygd deteksjon ennå. Dette vil låse begge kurs permanent.

**Q: Hvordan fjerner jeg alle avhengigheter?**  
A: Sett alle kurs til "Tilgjengelig umiddelbart" i struktur-editoren.

**Q: Kan jeg tvinge et låst kurs å åpne manuelt?**  
A: Ja, som admin i Oversikt-siden kan du alltid klikke "Lås opp" for å overstyre.

## Feilsøking

### Problem: "Struktur" knappen vises ikke
- **Løsning**: Refresh siden. Sjekk at programmet har minst 1 kurs.

### Problem: Ingen kurs vises i struktur-editoren
- **Løsning**: Gå tilbake til Kursadministrasjon og legg til kurs i programmet.

### Problem: Endringer lagres ikke
- **Løsning**: Sjekk browser console for feilmeldinger. Verifiser at migrasjonen er kjørt.

### Problem: Kurs låses ikke opp selv om forutsetninger er oppfylt
- **Løsning**: 
  1. Sjekk at triggeren er aktivert: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_course_completion_sequence'`
  2. Sjekk status i databasen: `SELECT * FROM program_assignments WHERE assigned_to_user_id = '<user_id>'`
  3. Prøv å manuelt låse opp fra Oversikt-siden

### Problem: "Min opplæring" oppdateres ikke
- **Løsning**: 
  1. Skift tab og tilbake (FocusRefresher trigger refresh)
  2. Hard refresh (Ctrl+Shift+R)
  3. Verifiser at `user_assignments` view er oppdatert

## Neste steg

- Les full dokumentasjon: `docs/FLEXIBLE-PROGRAM-DEPENDENCIES.md`
- Eksperimenter med ulike kombinasjoner
- Test alle 4 avhengighetstyper
- Gi feedback på hva som fungerer bra/dårlig

## ✅ Sjekkliste

- [ ] Database-migrasjoner kjørt
- [ ] Program opprettet
- [ ] Kurs lagt til i programmet
- [ ] Avhengigheter konfigurert i struktur-editor
- [ ] Program tildelt til bruker/avdeling
- [ ] Testet som bruker
- [ ] Testet manuell godkjenning (hvis aktuelt)
- [ ] Verifisert at locked/pending kurs vises korrekt
- [ ] Verifisert at kurs låses opp etter fullføring

**Gratulerer! Du har nå en fullkommen løsning for program-avhengigheter! 🎉**

