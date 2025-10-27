import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Plus, BookOpen, Users } from 'lucide-react'

export default function InstructorProgramsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mine programmer</h1>
          <p className="text-gray-600">Administrer dine opplæringsprogrammer</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nytt program
        </Button>
      </div>

      {/* Coming Soon */}
      <Card>
        <CardContent className="p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Instruktør-funksjoner kommer snart!
          </h3>
          <p className="text-gray-600 mb-4">
            Som instruktør vil du kunne:
          </p>
          <ul className="text-left text-gray-600 space-y-2 max-w-md mx-auto">
            <li>• Opprette egne opplæringsprogrammer</li>
            <li>• Lage moduler (video, dokument, quiz)</li>
            <li>• Følge opp deltakere</li>
            <li>• Se fremdrift på egne programmer</li>
            <li>• Gi feedback og vurderinger</li>
          </ul>
        </CardContent>
      </Card>

      {/* Quick Stats for Instructor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Mine programmer</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
              <BookOpen className="h-8 w-8 text-primary-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Totale deltakere</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
