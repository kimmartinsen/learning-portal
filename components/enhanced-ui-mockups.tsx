// UI-komponenter for den nye strukturen - MOCKUPS/EKSEMPLER

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { 
  Plus, 
  Settings, 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  Calendar,
  Target,
  BookOpen,
  Shield,
  Lock,
  Scale
} from 'lucide-react'

// 1. ADMIN: Tema-oversikt med hierarkisk struktur
export function ThemeManagementPage() {
  const [themes] = useState([
    {
      id: '1',
      name: 'HMS og Sikkerhet',
      description: 'Helse, miljø og sikkerhet opplæring',
      color: '#dc2626',
      icon: 'Shield',
      programs: [
        { id: '1', title: 'Brannvern og evakuering', assignments: 25, completion: 78 },
        { id: '2', title: 'Førstehjelp', assignments: 32, completion: 65 },
        { id: '3', title: 'Arbeid i høyden', assignments: 18, completion: 89 }
      ]
    },
    {
      id: '2', 
      name: 'IT-sikkerhet',
      description: 'Cybersikkerhet og databehandling',
      color: '#7c3aed',
      icon: 'Lock',
      programs: [
        { id: '4', title: 'Passord og autentisering', assignments: 45, completion: 92 },
        { id: '5', title: 'Phishing og sosial manipulasjon', assignments: 38, completion: 71 }
      ]
    }
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Opplæringstemaer</h1>
          <p className="text-gray-600">Organiser programmer i temaer for bedre oversikt</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nytt tema
        </Button>
      </div>

      {/* Tema-kort med programmer */}
      <div className="space-y-6">
        {themes.map((theme) => (
          <Card key={theme.id} className="overflow-hidden">
            <CardHeader className="pb-4" style={{ borderLeftColor: theme.color, borderLeftWidth: '4px' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: theme.color + '20' }}
                  >
                    <Shield className="w-5 h-5" style={{ color: theme.color }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{theme.name}</h3>
                    <p className="text-sm text-gray-600">{theme.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">{theme.programs.length} programmer</span>
                  <Button variant="ghost" size="sm">
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="grid gap-3">
                {theme.programs.map((program) => (
                  <div key={program.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <BookOpen className="w-4 h-4 text-gray-600" />
                      <span className="font-medium text-gray-900">{program.title}</span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4" />
                        <span>{program.assignments} tildelinger</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Target className="w-4 h-4" />
                        <span>{program.completion}% fullført</span>
                      </div>
                      <Button variant="ghost" size="sm">
                        Administrer
                      </Button>
                    </div>
                  </div>
                ))}
                
                <Button variant="ghost" className="mt-2 text-left justify-start" style={{ color: theme.color }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Legg til program i {theme.name}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// 2. ADMIN: Nytt tildelingssystem
export function ProgramAssignmentModal() {
  const [assignmentType, setAssignmentType] = useState<'user' | 'department' | 'bulk'>('user')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [dueDays, setDueDays] = useState(14)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <h3 className="text-lg font-semibold">Tildel opplæringsprogram</h3>
          <p className="text-sm text-gray-600">Brannvern og evakuering</p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Tildelingstype */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Hvem skal få denne opplæringen?
            </label>
            <div className="grid grid-cols-3 gap-3">
              <Button 
                variant={assignmentType === 'user' ? 'primary' : 'secondary'}
                onClick={() => setAssignmentType('user')}
                className="h-16 flex flex-col items-center justify-center space-y-1"
              >
                <Users className="w-5 h-5" />
                <span className="text-sm">Enkeltbruker</span>
              </Button>
              <Button 
                variant={assignmentType === 'department' ? 'primary' : 'secondary'}
                onClick={() => setAssignmentType('department')}
                className="h-16 flex flex-col items-center justify-center space-y-1"
              >
                <Users className="w-5 h-5" />
                <span className="text-sm">Hele avdeling</span>
              </Button>
              <Button 
                variant={assignmentType === 'bulk' ? 'primary' : 'secondary'}
                onClick={() => setAssignmentType('bulk')}
                className="h-16 flex flex-col items-center justify-center space-y-1"
              >
                <Target className="w-5 h-5" />
                <span className="text-sm">Flere personer</span>
              </Button>
            </div>
          </div>

          {/* Brukervalg */}
          {assignmentType === 'user' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Velg bruker
              </label>
              <select className="w-full rounded-md border-gray-300 shadow-sm">
                <option>Velg en bruker...</option>
                <option>Kim Martinsen</option>
                <option>Ola Nordmann</option>
                <option>Kari Hansen</option>
              </select>
            </div>
          )}

          {/* Frist og krav */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Frist (dager fra nå)
              </label>
              <Input
                type="number"
                value={dueDays}
                onChange={(e) => setDueDays(parseInt(e.target.value))}
                min="1"
                max="365"
              />
              <p className="text-xs text-gray-500 mt-1">
                Forfaller: {new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000).toLocaleDateString('no-NO')}
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maks forsøk
              </label>
              <Input type="number" defaultValue="3" min="1" max="10" />
            </div>
          </div>

          {/* Krav og varsling */}
          <div className="space-y-3">
            <label className="flex items-center">
              <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <span className="ml-2 text-sm text-gray-700">Obligatorisk opplæring</span>
            </label>
            
            <label className="flex items-center">
              <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <span className="ml-2 text-sm text-gray-700">Send påminnelse 3 dager før frist</span>
            </label>
          </div>

          {/* Notis til bruker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Melding til bruker (valgfri)
            </label>
            <textarea 
              className="w-full rounded-md border-gray-300 shadow-sm"
              rows={3}
              placeholder="F.eks. 'Dette er påkrevd grunnet nye HMS-forskrifter...'"
            />
          </div>

          {/* Handlinger */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="secondary">Avbryt</Button>
            <Button>
              <Calendar className="w-4 h-4 mr-2" />
              Tildel opplæring
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// 3. BRUKER: Forbedret "Min opplæring" med deadlines
export function EnhancedMyLearningPage() {
  const [assignments] = useState([
    {
      id: '1',
      program_title: 'Brannvern og evakuering',
      theme_name: 'HMS og Sikkerhet',
      theme_color: '#dc2626',
      calculated_status: 'not_started',
      days_remaining: 12,
      is_mandatory: true,
      progress_percentage: 0,
      modules_total: 5,
      modules_completed: 0,
      due_date: '2024-02-15'
    },
    {
      id: '2',
      program_title: 'Passord og autentisering',
      theme_name: 'IT-sikkerhet', 
      theme_color: '#7c3aed',
      calculated_status: 'in_progress',
      days_remaining: 6,
      is_mandatory: true,
      progress_percentage: 60,
      modules_total: 4,
      modules_completed: 2,
      due_date: '2024-02-09'
    },
    {
      id: '3',
      program_title: 'Kundebehandling telefon',
      theme_name: 'Kundeservice',
      theme_color: '#059669',
      calculated_status: 'overdue',
      days_remaining: -2,
      is_mandatory: false,
      progress_percentage: 25,
      modules_total: 3,
      modules_completed: 1,
      due_date: '2024-02-01'
    }
  ])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'in_progress': return <Clock className="w-5 h-5 text-blue-600" />
      case 'overdue': return <AlertTriangle className="w-5 h-5 text-red-600" />
      default: return <BookOpen className="w-5 h-5 text-gray-600" />
    }
  }

  const getStatusColor = (status: string, daysRemaining: number) => {
    if (status === 'overdue') return 'border-l-red-500 bg-red-50'
    if (status === 'completed') return 'border-l-green-500 bg-green-50'
    if (daysRemaining <= 3) return 'border-l-yellow-500 bg-yellow-50'
    return 'border-l-blue-500 bg-blue-50'
  }

  return (
    <div className="space-y-6">
      {/* Header med statistikk */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Min opplæring</h1>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Aktive</p>
                  <p className="text-2xl font-bold text-gray-900">3</p>
                </div>
                <BookOpen className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Forsinket</p>
                  <p className="text-2xl font-bold text-red-600">1</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Denne uken</p>
                  <p className="text-2xl font-bold text-yellow-600">1</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Fullførte</p>
                  <p className="text-2xl font-bold text-green-600">7</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tildelinger */}
      <div className="space-y-4">
        {assignments.map((assignment) => (
          <Card 
            key={assignment.id} 
            className={`${getStatusColor(assignment.calculated_status, assignment.days_remaining)} border-l-4`}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {getStatusIcon(assignment.calculated_status)}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {assignment.program_title}
                      </h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <span 
                          className="inline-flex px-2 py-1 text-xs font-medium rounded-full"
                          style={{ 
                            backgroundColor: assignment.theme_color + '20',
                            color: assignment.theme_color 
                          }}
                        >
                          {assignment.theme_name}
                        </span>
                        {assignment.is_mandatory && (
                          <span className="inline-flex px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                            Obligatorisk
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Fremdrift */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                      <span>Fremdrift: {assignment.modules_completed} av {assignment.modules_total} moduler</span>
                      <span>{assignment.progress_percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${assignment.progress_percentage}%`,
                          backgroundColor: assignment.theme_color 
                        }}
                      />
                    </div>
                  </div>

                  {/* Frist og status */}
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className={assignment.days_remaining < 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                        {assignment.days_remaining < 0 
                          ? `${Math.abs(assignment.days_remaining)} dager forsinket`
                          : assignment.days_remaining === 0
                          ? 'Frist i dag!'
                          : `${assignment.days_remaining} dager igjen`
                        }
                      </span>
                    </div>
                    <span className="text-gray-600">
                      Frist: {new Date(assignment.due_date).toLocaleDateString('no-NO')}
                    </span>
                  </div>
                </div>

                <div className="ml-4">
                  <Button 
                    className={assignment.calculated_status === 'overdue' ? 'bg-red-600 hover:bg-red-700' : ''}
                  >
                    {assignment.calculated_status === 'completed' ? 'Se igjen' :
                     assignment.calculated_status === 'in_progress' ? 'Fortsett' :
                     assignment.calculated_status === 'overdue' ? 'Start nå!' : 'Start'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// 4. ADMIN: Dashboard med oversikt over tildelinger
export function AdminAssignmentDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tildelingsoversikt</h1>
        <p className="text-gray-600">Oversikt over alle aktive opplæringstildelinger</p>
      </div>

      {/* Hurtigstatistikk */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Aktive tildelinger</p>
                <p className="text-2xl font-bold text-gray-900">127</p>
              </div>
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Forsinkede</p>
                <p className="text-2xl font-bold text-red-600">8</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Fullførte denne måneden</p>
                <p className="text-2xl font-bold text-green-600">43</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Gjennomsnittlig fullføringstid</p>
                <p className="text-2xl font-bold text-gray-900">11d</p>
              </div>
              <Clock className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kommende frister */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Kommende frister (neste 7 dager)</h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { user: 'Ola Nordmann', program: 'Brannvern', days: 2, status: 'in_progress' },
              { user: 'Kari Hansen', program: 'IT-sikkerhet', days: 3, status: 'not_started' },
              { user: 'Per Olsen', program: 'Kundeservice', days: 5, status: 'in_progress' },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{item.user}</p>
                  <p className="text-sm text-gray-600">{item.program}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`text-sm font-medium ${item.days <= 3 ? 'text-red-600' : 'text-gray-600'}`}>
                    {item.days} dager igjen
                  </span>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    item.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {item.status === 'in_progress' ? 'I gang' : 'Ikke startet'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
