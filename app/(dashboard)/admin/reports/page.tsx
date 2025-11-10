import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Download, BarChart3, Users, TrendingUp } from 'lucide-react'

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Rapporter</h1>
          <p className="text-gray-600 dark:text-gray-300">Oversikt og statistikk for opplæring</p>
        </div>
        <Button>
          <Download className="w-4 h-4 mr-2" />
          Eksporter data
        </Button>
      </div>

      {/* Coming Soon */}
      <Card>
        <CardContent className="p-12 text-center">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Rapporter kommer snart!
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Denne funksjonen er under utvikling. Her vil du kunne:
          </p>
          <ul className="text-left text-gray-600 dark:text-gray-300 space-y-2 max-w-md mx-auto">
            <li>• Se fullføringsstatistikk per avdeling</li>
            <li>• Eksportere rapporter (CSV/Excel)</li>
            <li>• Følge opp brukere med frister</li>
            <li>• Visualisere fremgang med grafer</li>
            <li>• Badge-oversikt og tildeling</li>
          </ul>
        </CardContent>
      </Card>

      {/* Mock Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Gjennomføringsgrad</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">0%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Aktive brukere</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">1</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Utdelte badges</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">0</p>
              </div>
              <BarChart3 className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
