import Link from 'next/link'
import { ArrowRight, ShieldCheck, Users, Layers } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const features = [
  {
    title: 'Alt på ett sted',
    description:
      'Samle kurs, dokumentasjon og intern opplæring i én strukturert portal som er enkel å holde oppdatert.',
    icon: Layers
  },
  {
    title: 'Trygg dokumentasjon',
    description:
      'Følg opp både lovpålagte og interne krav med sporbar progresjon, sertifiseringer og revisjonslogg.',
    icon: ShieldCheck
  },
  {
    title: 'Engasjer teamet',
    description:
      'Gi ansatte og instruktører en oversiktlig opplevelse med tydelige mål, påminnelser og praktiske verktøy.',
    icon: Users
  }
]

export default async function HomePage() {
  const supabase = createServerSupabaseClient()

  const {
    data: { session }
  } = await supabase.auth.getSession()

  const isAuthenticated = Boolean(session)

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-100 via-white to-transparent dark:from-blue-900/20 dark:via-gray-950 dark:to-transparent" />

        <header className="px-6 py-6 sm:px-10">
          <nav className="flex items-center justify-between">
            <Link href="/" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Opplæringsportal
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="rounded-full border border-transparent bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              >
                Logg inn
              </Link>
              <Link
                href="/signup"
                className="hidden rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:border-gray-500 sm:inline-flex"
              >
                Registrer deg
              </Link>
            </div>
          </nav>
        </header>

        <section className="px-6 pb-16 pt-12 sm:px-10 lg:flex lg:items-center lg:gap-12 lg:pb-24 lg:pt-20">
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              For bedrifter som satser på kompetanse
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl">
              Gjør opplæring enkelt å planlegge, levere og dokumentere
            </h1>
            <p className="mt-6 text-lg text-gray-600 dark:text-gray-300">
              Med Opplæringsportalen får du et helhetlig verktøy for å lage kurs, tildele oppgaver, følge
              opp status og dokumentere gjennomføringen. Alt i én løsning — tilpasset norske bedrifter.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
              >
                Logg inn
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-full border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:border-gray-500"
              >
                Registrer deg
              </Link>
            </div>
          </div>
          <div className="mt-12 hidden h-full w-full max-w-xl shrink-0 rounded-3xl border border-gray-200 bg-white p-8 shadow-xl shadow-blue-500/10 dark:border-gray-800 dark:bg-gray-900 dark:shadow-blue-900/20 lg:block">
            <div className="space-y-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                  Oversikt
                </p>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Se hvordan teamet ligger an i sine kurs, og få kontroll over hvem som trenger oppfølging.
                </p>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">HMS og Sikkerhet</p>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">72% fullført · 12 deltakere</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Nye ansatte</p>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">55% fullført · 8 deltakere</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Fagbrev-oppfølging</p>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Planlagt · Oppstart 15. januar</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-gray-950 sm:px-10">
          <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-3">
            {features.map(({ title, description, icon: Icon }) => (
              <div key={title} className="space-y-4">
                <div className="inline-flex rounded-full bg-blue-100 p-3 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer className="border-t border-gray-200 bg-white px-6 py-8 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400 sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Opplæringsportal. Alle rettigheter forbeholdt.</p>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-gray-900 dark:hover:text-gray-200">
              Logg inn
            </Link>
            <Link href="/signup" className="hover:text-gray-900 dark:hover:text-gray-200">
              Registrer deg
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
