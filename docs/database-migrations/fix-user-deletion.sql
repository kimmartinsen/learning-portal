-- Skript for å fikse problemer med sletting av brukere i Supabase
-- Dette skriptet rydder opp i "foreldreløse" filer og brukere som har blitt stående igjen etter en ufullstendig sletting.

-- 1. Slett filer i Storage som tilhører brukere som ikke lenger har en profil (eller som skal slettes)
-- Dette er ofte årsaken til "Internal Server Error" ved sletting av brukere,
-- fordi Supabase ikke automatisk sletter brukerens filer når brukeren slettes.
DELETE FROM storage.objects
WHERE owner IN (
    SELECT id FROM auth.users
    WHERE id NOT IN (SELECT id FROM public.profiles)
);

-- 2. Slett brukere fra auth.users som ikke har en profil i public.profiles
-- Dette fjerner brukerne som du ser i "Authentication" men som ikke lenger finnes i appen.
DELETE FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

-- ALTERNATIVT: Hvis du vil slette spesifikke e-poster, bruk denne i stedet for steg 2:
-- DELETE FROM auth.users WHERE email IN ('jarle@hotmail.com', 'kim.martinsen@helsenor.no');

