import Link from 'next/link'
import { ArrowRight, GraduationCap, ClipboardCheck, Users, Building2, BarChart3, FolderTree } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ThemeToggle } from '@/components/shared/ThemeToggle'

const features = [
  {
    title: 'Strukturert kursoppsett',
    description:
      'Organiser opplæringen i tre nivåer: Tema, Program og Kurs. Perfekt for å gruppere relaterte kurs under felles kategorier.',
    icon: FolderTree
  },
  {
    title: 'Fleksible sjekklister',
    description:
      'Opprett sjekklister for onboarding, HMS-rutiner eller andre oppgaver. Følg opp status og marker punkter som fullført.',
    icon: ClipboardCheck
  },
  {
    title: 'Enkel tildeling',
    description:
      'Tildel kurs og sjekklister til enkeltpersoner eller hele avdelinger med ett klikk. Automatisk oppfølging av progresjon.',
    icon: Users
  },
  {
    title: 'Avdelingsbasert',
    description:
      'Organiser ansatte i avdelinger for enklere administrasjon. Tildel opplæring til hele grupper samtidig.',
    icon: Building2
  },
  {
    title: 'Full oversikt',
    description:
      'Se hvem som har fullført hva, hvem som ligger etter, og få kontroll over all opplæring i bedriften.',
    icon: BarChart3
  },
  {
    title: 'Kursbibliotek',
    description:
      'Bygg opp et bibliotek med kurs som kan gjenbrukes. Legg til videoer, dokumenter og quizer.',
    icon: GraduationCap
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
              Kompetanseportalen
            </Link>
            <div className="flex items-center gap-3">
              <ThemeToggle />
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
              Komplett opplæringsverktøy
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl">
              Kurs, sjekklister og kompetanseoversikt i én løsning
            </h1>
            <p className="mt-6 text-lg text-gray-600 dark:text-gray-300">
              Kompetanseportalen gir deg full kontroll over bedriftens opplæring. Opprett kurs organisert 
              i temaer og programmer, lag sjekklister for onboarding og rutiner, og følg opp hvem som 
              har fullført hva — alt på ett sted.
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
                Registrer din bedrift
              </Link>
            </div>
          </div>
          <div className="mt-12 hidden h-full w-full max-w-xl shrink-0 rounded-3xl border border-gray-200 bg-white p-6 shadow-xl shadow-blue-500/10 dark:border-gray-800 dark:bg-gray-900 dark:shadow-blue-900/20 lg:block">
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-300">
                <FolderTree className="h-4 w-4" />
                Kursstruktur
              </div>
              
              {/* Tema level */}
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/50">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">Tema</p>
                <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">HMS og Sikkerhet</p>
                
                {/* Program level */}
                <div className="mt-3 ml-3 space-y-2">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-800 dark:bg-emerald-950/50">
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Program</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Grunnleggende HMS</p>
                    
                    {/* Kurs level */}
                    <div className="mt-2 ml-2 space-y-1">
                      <div className="flex items-center gap-2 rounded bg-white p-1.5 text-xs dark:bg-gray-800">
                        <span className="h-2 w-2 rounded-full bg-green-500"></span>
                        <span className="text-gray-600 dark:text-gray-400">Brannvern</span>
                        <span className="ml-auto text-green-600 dark:text-green-400">Fullført</span>
                      </div>
                      <div className="flex items-center gap-2 rounded bg-white p-1.5 text-xs dark:bg-gray-800">
                        <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                        <span className="text-gray-600 dark:text-gray-400">Førstehjelp</span>
                        <span className="ml-auto text-yellow-600 dark:text-yellow-400">I gang</span>
                      </div>
                      <div className="flex items-center gap-2 rounded bg-white p-1.5 text-xs dark:bg-gray-800">
                        <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                        <span className="text-gray-600 dark:text-gray-400">Ergonomi</span>
                        <span className="ml-auto text-gray-500">Ikke startet</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sjekkliste eksempel */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/50">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Sjekkliste</p>
                </div>
                <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">Onboarding ny ansatt</p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span className="text-green-500">✓</span> Signert arbeidskontrakt
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span className="text-green-500">✓</span> IT-utstyr utlevert
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span className="text-gray-400">○</span> Gjennomført HMS-opplæring
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-gray-950 sm:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
                Alt du trenger for effektiv opplæring
              </h2>
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                Fra kursbygging til oppfølging — Kompetanseportalen dekker hele prosessen.
              </p>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ title, description, icon: Icon }) => (
                <div key={title} className="rounded-2xl border border-gray-100 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900">
                  <div className="inline-flex rounded-xl bg-blue-100 p-3 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-gray-200 bg-white px-6 py-8 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400 sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Kompetanseportalen. Alle rettigheter forbeholdt.</p>
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
