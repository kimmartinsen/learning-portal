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
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white font-semibold">
                O
              </div>
              <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Kompetanseportalen
              </span>
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
          <div className="mt-12 hidden h-full w-full max-w-xl shrink-0 rounded-3xl border border-gray-200 bg-white p-5 shadow-xl shadow-blue-500/10 dark:border-gray-800 dark:bg-gray-900 dark:shadow-blue-900/20 lg:block">
            <div className="space-y-4">
              {/* Kursprogram eksempel */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                {/* Tema header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <FolderTree className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">HMS</span>
                  <span className="text-xs text-gray-500">1 program</span>
                </div>
                
                {/* Program header */}
                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Grunnkurs</span>
                  </div>
                </div>

                {/* Tabell */}
                <div className="overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Bruker</th>
                        <th className="px-2 py-2 text-center font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">1. Intro</th>
                        <th className="px-2 py-2 text-center font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">2. Quiz</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                      <tr>
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900 dark:text-gray-100">Ola Nordmann</div>
                          <div className="text-gray-500 text-[10px]">Salg</div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400">Fullført</span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="inline-flex items-center rounded bg-yellow-100 px-2 py-0.5 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">I gang</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900 dark:text-gray-100">Kari Hansen</div>
                          <div className="text-gray-500 text-[10px]">Drift</div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-400">Ikke startet</span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-400">Ikke startet</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sjekkliste eksempel */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                {/* Sjekkliste header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <ClipboardCheck className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Onboarding</span>
                </div>

                {/* Tabell */}
                <div className="overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Bruker</th>
                        <th className="px-2 py-2 text-center font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">1. Kontrakt</th>
                        <th className="px-2 py-2 text-center font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">2. IT-utstyr</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                      <tr>
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900 dark:text-gray-100">Per Olsen</div>
                          <div className="text-gray-500 text-[10px]">IT</div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400">Fullført</span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400">Fullført</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
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
