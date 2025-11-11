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
          <div className="mx-auto flex max-w-lg flex-col items-stretch">
            <div className="rounded-3xl border border-gray-200 bg-white/90 p-8 shadow-xl shadow-blue-500/10 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 dark:shadow-blue-900/20">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
