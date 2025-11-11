export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'

export default async function AdminOverviewPage() {
  const supabase = createServerSupabaseClient()

  const {
    data: { session }
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', session.user.id)
    .single()

  const adminLinks = [
    {
      title: 'Programmer',
      description: 'Opprett og administrer opplæringsprogrammer og temaer.',
      href: '/dashboard/admin/programs',
    },
    {
      title: 'Temaoversikt',
      description: 'Følg progresjon og status for temaer i bedriften.',
      href: '/dashboard/admin/themes',
    },
    {
      title: 'Brukere',
      description: 'Administrer ansatte, instruktører og tilganger.',
      href: '/dashboard/admin/users',
    },
    {
      title: 'Avdelinger',
      description: 'Organiser team og avdelinger for rask tildeling.',
      href: '/dashboard/admin/departments',
    },
    {
      title: 'Rapporter',
      description: 'Se nøkkeltall og hent ut dokumentasjon.',
      href: '/dashboard/admin/reports',
    },
  ]

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Hei {profile?.full_name ? profile.full_name : 'administrator'} 👋
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Velg ett av områdene under for å komme i gang med administrasjonen av opplæringsportalen.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {adminLinks.map((link) => (
          <Card key={link.href} className="h-full border border-gray-200 transition hover:border-blue-400 dark:border-gray-800 dark:hover:border-blue-500/60">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{link.title}</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">{link.description}</p>
              <Link
                href={link.href}
                className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              >
                Åpne
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

