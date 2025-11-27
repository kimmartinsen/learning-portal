# 📧 E-postoppsett for Opplæringsportalen

Dette dokumentet beskriver hvordan du setter opp automatisk e-postutsending når nye brukere opprettes.

## 🎯 Funksjonalitet

Når en admin oppretter en ny bruker, sendes automatisk en velkomst-e-post med:
- E-postadresse
- Midlertidig passord
- Lenke til innlogging
- Informasjon om at passord må endres ved første innlogging

## 🔧 Oppsett med Resend (Anbefalt)

### 1. Opprett Resend-konto

1. Gå til [resend.com](https://resend.com)
2. Opprett en gratis konto (100 e-poster/dag)
3. Verifiser din e-postadresse

### 2. Legg til API-nøkkel

1. Gå til [API Keys](https://resend.com/api-keys) i Resend-dashboardet
2. Klikk "Create API Key"
3. Gi den et navn (f.eks. "Opplæringsportal")
4. Kopier API-nøkkelen

### 3. Legg til miljøvariabler

Legg til følgende i `.env.local`:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=Opplæringsportal <noreply@dittdomene.no>
NEXT_PUBLIC_APP_URL=https://dittdomene.no
```

**Viktig:**
- `RESEND_FROM_EMAIL` må være en verifisert domene i Resend
- For testing kan du bruke `onboarding@resend.dev` (kun for testing)

### 4. Installer Resend (hvis nødvendig)

```bash
npm install resend
```

## 🔄 Alternativ: Bruk Supabase sin e-posttjeneste

Hvis du ikke vil bruke Resend, kan du konfigurere Supabase til å sende e-poster:

1. Gå til Supabase Dashboard → Authentication → Email Templates
2. Tilpass e-postmalene
3. Konfigurer SMTP-innstillinger hvis nødvendig

**Merk:** Supabase sin innebygde e-posttjeneste har begrensninger, så Resend anbefales for produksjon.

## 📝 E-postmal

E-posten som sendes inneholder:
- Velkomstmelding
- E-postadresse
- Midlertidig passord (markert som viktig)
- Lenke til innlogging
- Informasjon om passordendring

## 🧪 Testing

For å teste uten å faktisk sende e-post:

1. La `RESEND_API_KEY` være tom i `.env.local`
2. Systemet vil logge en advarsel, men fortsette
3. Sjekk konsollen for feilmeldinger

## 🚨 Feilsøking

### E-post sendes ikke

1. Sjekk at `RESEND_API_KEY` er satt riktig
2. Verifiser at `RESEND_FROM_EMAIL` er et verifisert domene
3. Sjekk Resend-dashboardet for feilmeldinger
4. Sjekk server-loggene for feil

### E-post går til spam

1. Verifiser ditt domene i Resend
2. Legg til SPF/DKIM/DMARC records
3. Vurder å bruke en dedikert e-postadresse

## 📚 Ressurser

- [Resend Dokumentasjon](https://resend.com/docs)
- [Resend API Reference](https://resend.com/docs/api-reference/emails/send-email)
- [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)

