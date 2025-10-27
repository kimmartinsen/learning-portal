import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Download, BarChart3, Users, Clock } from 'lucide-react'

export default function InstructorReportsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mine rapporter</h1>
          <p className="text-gray-600">Statistikk for dine opplæringsprogrammer</p>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Instruktør-rapporter kommer snart!
          </h3>
          <p className="text-gray-600 mb-4">
            Som instruktør vil du kunne se:
          </p>
          <ul className="text-left text-gray-600 space-y-2 max-w-md mx-auto">
            <li>• Fremdrift på egne programmer</li>
            <li>• Deltaker-statistikk og engagement</li>
            <li>• Quiz-resultater og score</li>
            <li>• Tid brukt per modul</li>
            <li>• Eksportere deltakerlister</li>
          </ul>
        </CardContent>
      </Card>

      {/* Mock Stats for Instructor */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Gjennomsnittsscore</p>
                <p className="text-2xl font-bold text-gray-900">0%</p>
              </div>
              <BarChart3 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Aktive deltakere</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Gjennomsnittlig tid</p>
                <p className="text-2xl font-bold text-gray-900">0 min</p>
              </div>
              <Clock className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
