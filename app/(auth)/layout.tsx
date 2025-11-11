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
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
            <div className="hidden h-full rounded-3xl border border-gray-200 bg-white/70 p-8 shadow-xl shadow-blue-500/10 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80 dark:shadow-blue-900/20 lg:block">
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                    Eksempeloversikt
                  </p>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Slik kan dashboardet se ut når teamet ditt er i gang.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">HMS og sikkerhet</p>
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

            <div className="rounded-3xl border border-gray-200 bg-white/90 p-8 shadow-xl shadow-blue-500/10 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 dark:shadow-blue-900/20">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
