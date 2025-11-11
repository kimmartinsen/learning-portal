import { AuthHeader } from '@/components/auth/AuthHeader'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-100 via-white to-transparent dark:from-blue-900/20 dark:via-gray-950 dark:to-transparent" />

        <AuthHeader />

        <main className="px-6 pb-16 pt-12 sm:px-10">
          <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
            <div className="space-y-6">
              <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                Kom i gang på minutter
              </span>
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl">
                Samle opplæringen i én moderne portal
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                Tilpass opplevelsen for ansatte og instruktører, følg progresjon i sanntid og sikre at
                bedriften dokumenterer all kritisk læring. Logg inn eller opprett en konto for å komme i gang.
              </p>
              <ul className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
                  Enkel oversikt over kurs, temaer og tildelinger
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
                  Automatiske påminnelser og sporbar dokumentasjon
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
                  Støtte for både lys og mørk modus
                </li>
              </ul>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white/90 p-8 shadow-xl shadow-blue-500/10 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 dark:shadow-blue-900/20">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
