'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

type AdminProfile = {
  full_name: string | null
}

export default function AdminOverviewPage() {
  const [profile, setProfile] = useState<AdminProfile | null>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (!session) {
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single()

      if (data) {
        setProfile(data)
      }
    }

    fetchProfile()
  }, [])

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
              <Button asChild variant="secondary" className="w-full justify-center">
                <Link href={link.href}>Åpne</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

