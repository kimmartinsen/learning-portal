'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Plus, 
  Edit2, 
  Trash2, 
  BookOpen, 
  PlayCircle,
  Award,
  GripVertical,
  Eye,
  Save,
  X
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Module {
  id: string
  title: string
  description: string | null
  type: string
  content: any
  order_index: number
  has_questions: boolean
  is_final_quiz: boolean
}

interface Program {
  id: string
  title: string
  description: string | null
  modules: Module[]
}

interface Props {
  program: Program
  companyId: string
}

export default function ModuleBuilder({ program, companyId }: Props) {
  const router = useRouter()
  const [modules, setModules] = useState<Module[]>(program.modules.sort((a, b) => a.order_index - b.order_index))
  const [showModuleForm, setShowModuleForm] = useState(false)
  const [editingModule, setEditingModule] = useState<Module | null>(null)
  const [moduleType, setModuleType] = useState<'text' | 'video' | 'final_quiz'>('text')
  const [loading, setLoading] = useState(false)

  const [moduleForm, setModuleForm] = useState({
    title: '',
    description: '',
    type: 'text',
    emoji: '',
    estimatedMinutes: 5,
    text: '',
    images: [] as any[],
    videoUrl: '',
    requireFullWatch: true,
    questions: [] as any[],
    passingScore: 80,
    allowMultipleAttempts: true,
    showResultsImmediately: true,
    showIncorrectAnswers: true,
    shuffleQuestions: false,
    shuffleOptions: false
  })

  const resetModuleForm = () => {
    setModuleForm({
      title: '',
      description: '',
      type: 'text',
      emoji: '',
      estimatedMinutes: 5,
      text: '',
      images: [],
      videoUrl: '',
      requireFullWatch: true,
      questions: [],
      passingScore: 80,
      allowMultipleAttempts: true,
      showResultsImmediately: true,
      showIncorrectAnswers: true,
      shuffleQuestions: false,
      shuffleOptions: false
    })
    setModuleType('text')
  }

  const handleCreateModule = (type: 'text' | 'video' | 'final_quiz') => {
    setModuleType(type)
    resetModuleForm()
    setModuleForm(prev => ({ ...prev, type }))
    setEditingModule(null)
    setShowModuleForm(true)
  }

  const handleEditModule = (module: Module) => {
    setEditingModule(module)
    setModuleType(module.type as any)
    setModuleForm({
      title: module.title,
      description: module.description || '',
      type: module.type,
      emoji: module.content?.emoji || '',
      estimatedMinutes: module.content?.estimatedMinutes || 5,
      text: module.content?.text || '',
      images: module.content?.images || [],
      videoUrl: module.content?.videoUrl || '',
      requireFullWatch: module.content?.requireFullWatch || true,
      questions: module.content?.questions || [],
      passingScore: module.content?.passingScore || 80,
      allowMultipleAttempts: module.content?.allowMultipleAttempts || true,
      showResultsImmediately: module.content?.showResultsImmediately || true,
      showIncorrectAnswers: module.content?.showIncorrectAnswers || true,
      shuffleQuestions: module.content?.shuffleQuestions || false,
      shuffleOptions: module.content?.shuffleOptions || false
    })
    setShowModuleForm(true)
  }

  const handleSaveModule = async () => {
    if (!moduleForm.title.trim()) {
      toast.error('Tittel er påkrevd')
      return
    }

    setLoading(true)

    try {
      const content = {
        type: moduleType,
        title: moduleForm.title,
        emoji: moduleForm.emoji,
        estimatedMinutes: moduleForm.estimatedMinutes,
        ...(moduleType === 'text' && {
          text: moduleForm.text,
          images: moduleForm.images,
          questions: moduleForm.questions
        }),
        ...(moduleType === 'video' && {
          videoUrl: moduleForm.videoUrl,
          requireFullWatch: moduleForm.requireFullWatch,
          questions: moduleForm.questions
        }),
        ...(moduleType === 'final_quiz' && {
          totalQuestions: moduleForm.questions.length,
          passingScore: moduleForm.passingScore,
          estimatedMinutes: moduleForm.estimatedMinutes,
          allowMultipleAttempts: moduleForm.allowMultipleAttempts,
          showResultsImmediately: moduleForm.showResultsImmediately,
          showIncorrectAnswers: moduleForm.showIncorrectAnswers,
          shuffleQuestions: moduleForm.shuffleQuestions,
          shuffleOptions: moduleForm.shuffleOptions,
          questions: moduleForm.questions
        })
      }

      const moduleData = {
        title: moduleForm.title,
        description: moduleForm.description || null,
        type: moduleType,
        content,
        program_id: program.id,
        has_questions: moduleForm.questions.length > 0,
        is_final_quiz: moduleType === 'final_quiz',
        order_index: editingModule ? editingModule.order_index : modules.length
      }

      if (editingModule) {
        // Update existing module
        const { data, error } = await supabase
          .from('modules')
          .update(moduleData)
          .eq('id', editingModule.id)
          .select()
          .single()

        if (error) throw error

        setModules(prev => prev.map(m => m.id === editingModule.id ? { ...m, ...data } : m))
        toast.success('Modul oppdatert!')
      } else {
        // Create new module
        const { data, error } = await supabase
          .from('modules')
          .insert([moduleData])
          .select()
          .single()

        if (error) throw error

        setModules(prev => [...prev, data])
        toast.success('Modul opprettet!')
      }

      setShowModuleForm(false)
      setEditingModule(null)
      resetModuleForm()
    } catch (error: any) {
      console.error('Error saving module:', error)
      toast.error('Kunne ikke lagre modul: ' + (error.message || 'Ukjent feil'))
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Er du sikker på at du vil slette denne modulen?')) return

    try {
      const { error } = await supabase
        .from('modules')
        .delete()
        .eq('id', moduleId)

      if (error) throw error

      setModules(prev => prev.filter(m => m.id !== moduleId))
      toast.success('Modul slettet!')
    } catch (error: any) {
      console.error('Error deleting module:', error)
      toast.error('Kunne ikke slette modul')
    }
  }

  const addQuestion = () => {
    const newQuestion = {
      id: `q${Date.now()}`,
      question: '',
      options: ['', '', '', ''],
      correctIndex: 0,
      explanation: ''
    }
    setModuleForm(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }))
  }

  const updateQuestion = (index: number, field: string, value: any) => {
    setModuleForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === index ? { ...q, [field]: value } : q
      )
    }))
  }

  const removeQuestion = (index: number) => {
    setModuleForm(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }))
  }

  const getModuleIcon = (module: Module) => {
    if (module.is_final_quiz) return <Award className="w-5 h-5 text-yellow-600" />
    if (module.type === 'video') return <PlayCircle className="w-5 h-5 text-primary-600" />
    return <BookOpen className="w-5 h-5 text-primary-600" />
  }

  const previewProgram = () => {
    window.open(`/programs/${program.id}`, '_blank')
  }

  if (showModuleForm) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button 
                  variant="ghost" 
                  onClick={() => setShowModuleForm(false)}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Tilbake
                </Button>
                <h1 className="text-xl font-semibold text-gray-900">
                  {editingModule ? 'Rediger modul' : 'Ny modul'}
                </h1>
              </div>
              <div className="flex space-x-3">
                <Button variant="secondary" onClick={() => setShowModuleForm(false)}>
                  Avbryt
                </Button>
                <Button onClick={handleSaveModule} disabled={loading}>
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Lagrer...' : 'Lagre modul'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Grunnleggende informasjon</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tittel *
                  </label>
                  <Input
                    value={moduleForm.title}
                    onChange={(e) => setModuleForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Modulens tittel"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Beskrivelse
                  </label>
                  <Input
                    value={moduleForm.description}
                    onChange={(e) => setModuleForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Kort beskrivelse av modulen"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Emoji (valgfri)
                    </label>
                    <Input
                      value={moduleForm.emoji}
                      onChange={(e) => setModuleForm(prev => ({ ...prev, emoji: e.target.value }))}
                      placeholder="🔥"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estimert tid (minutter)
                    </label>
                    <Input
                      type="number"
                      value={moduleForm.estimatedMinutes}
                      onChange={(e) => setModuleForm(prev => ({ ...prev, estimatedMinutes: parseInt(e.target.value) || 5 }))}
                      min="1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Module Content */}
            {moduleType === 'text' && (
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold">Tekstinnhold</h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Innhold (støtter Markdown)
                    </label>
                    <textarea
                      className="w-full h-64 p-3 border border-gray-300 rounded-lg resize-vertical focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      value={moduleForm.text}
                      onChange={(e) => setModuleForm(prev => ({ ...prev, text: e.target.value }))}
                      placeholder="# Overskrift&#10;&#10;Skriv modulens innhold her...&#10;&#10;- Punkt 1&#10;- Punkt 2"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {moduleType === 'video' && (
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold">Videoinnhold</h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Video URL
                    </label>
                    <Input
                      value={moduleForm.videoUrl}
                      onChange={(e) => setModuleForm(prev => ({ ...prev, videoUrl: e.target.value }))}
                      placeholder="https://youtube.com/watch?v=... eller Supabase Storage URL"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="requireFullWatch"
                      checked={moduleForm.requireFullWatch}
                      onChange={(e) => setModuleForm(prev => ({ ...prev, requireFullWatch: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="requireFullWatch" className="text-sm text-gray-700">
                      Krev at hele videoen sees før man kan fortsette
                    </label>
                  </div>
                </CardContent>
              </Card>
            )}

            {moduleType === 'final_quiz' && (
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold">Quiz-innstillinger</h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Kravscore for å bestå (%)
                      </label>
                      <Input
                        type="number"
                        value={moduleForm.passingScore}
                        onChange={(e) => setModuleForm(prev => ({ ...prev, passingScore: parseInt(e.target.value) || 80 }))}
                        min="1"
                        max="100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Estimert tid (minutter)
                      </label>
                      <Input
                        type="number"
                        value={moduleForm.estimatedMinutes}
                        onChange={(e) => setModuleForm(prev => ({ ...prev, estimatedMinutes: parseInt(e.target.value) || 10 }))}
                        min="1"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="allowMultipleAttempts"
                        checked={moduleForm.allowMultipleAttempts}
                        onChange={(e) => setModuleForm(prev => ({ ...prev, allowMultipleAttempts: e.target.checked }))}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="allowMultipleAttempts" className="text-sm text-gray-700">
                        Tillat flere forsøk
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="showResultsImmediately"
                        checked={moduleForm.showResultsImmediately}
                        onChange={(e) => setModuleForm(prev => ({ ...prev, showResultsImmediately: e.target.checked }))}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="showResultsImmediately" className="text-sm text-gray-700">
                        Vis resultat umiddelbart etter fullført
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="showIncorrectAnswers"
                        checked={moduleForm.showIncorrectAnswers}
                        onChange={(e) => setModuleForm(prev => ({ ...prev, showIncorrectAnswers: e.target.checked }))}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="showIncorrectAnswers" className="text-sm text-gray-700">
                        Vis hvilke spørsmål som ble feil
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="shuffleQuestions"
                        checked={moduleForm.shuffleQuestions}
                        onChange={(e) => setModuleForm(prev => ({ ...prev, shuffleQuestions: e.target.checked }))}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="shuffleQuestions" className="text-sm text-gray-700">
                        Bland rekkefølge på spørsmål
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="shuffleOptions"
                        checked={moduleForm.shuffleOptions}
                        onChange={(e) => setModuleForm(prev => ({ ...prev, shuffleOptions: e.target.checked }))}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="shuffleOptions" className="text-sm text-gray-700">
                        Bland rekkefølge på svaralternativer
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Questions Section */}
            {(moduleType === 'text' || moduleType === 'video' || moduleType === 'final_quiz') && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">
                      {moduleType === 'final_quiz' ? 'Quiz-spørsmål' : 'Kunnskapskontroll'}
                    </h2>
                    <Button onClick={addQuestion} size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Legg til spørsmål
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {moduleForm.questions.length === 0 ? (
                    <p className="text-gray-600 text-center py-8">
                      Ingen spørsmål lagt til ennå. Klikk "Legg til spørsmål" for å starte.
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {moduleForm.questions.map((question, qIndex) => (
                        <div key={qIndex} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-4">
                            <h3 className="font-medium text-gray-900">
                              Spørsmål {qIndex + 1}
                            </h3>
                            <Button
                              variant="ghost"
                              onClick={() => removeQuestion(qIndex)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Spørsmål
                              </label>
                              <Input
                                value={question.question}
                                onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                                placeholder="Skriv spørsmålet her..."
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Svaralternativer
                              </label>
                              <div className="space-y-2">
                                {question.options.map((option: string, oIndex: number) => (
                                  <div key={oIndex} className="flex items-center space-x-3">
                                    <input
                                      type="radio"
                                      name={`correct-${qIndex}`}
                                      checked={question.correctIndex === oIndex}
                                      onChange={() => updateQuestion(qIndex, 'correctIndex', oIndex)}
                                      className="text-primary-600"
                                    />
                                    <Input
                                      value={option}
                                      onChange={(e) => {
                                        const newOptions = [...question.options]
                                        newOptions[oIndex] = e.target.value
                                        updateQuestion(qIndex, 'options', newOptions)
                                      }}
                                      placeholder={`Alternativ ${String.fromCharCode(65 + oIndex)}`}
                                      className="flex-1"
                                    />
                                    <span className="text-xs text-gray-500 w-12">
                                      {question.correctIndex === oIndex ? 'Riktig' : ''}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Forklaring (vises etter svar)
                              </label>
                              <Input
                                value={question.explanation || ''}
                                onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)}
                                placeholder="Forklar hvorfor dette er riktig svar..."
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Main module list view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                onClick={() => router.push('/admin/programs')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Tilbake til programmer
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Rediger: {program.title}
                </h1>
                <p className="text-sm text-gray-600">
                  Administrer moduler og innhold
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Button variant="secondary" onClick={previewProgram}>
                <Eye className="w-4 h-4 mr-2" />
                Forhåndsvis
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Add Module Buttons */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Legg til ny modul</h2>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  variant="secondary"
                  onClick={() => handleCreateModule('text')}
                  className="h-20 flex flex-col items-center justify-center space-y-2"
                >
                  <BookOpen className="w-6 h-6" />
                  <span>Tekstmodul</span>
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => handleCreateModule('video')}
                  className="h-20 flex flex-col items-center justify-center space-y-2"
                >
                  <PlayCircle className="w-6 h-6" />
                  <span>Videomodul</span>
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => handleCreateModule('final_quiz')}
                  className="h-20 flex flex-col items-center justify-center space-y-2"
                >
                  <Award className="w-6 h-6" />
                  <span>Avsluttende Quiz</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Existing Modules */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">
                Moduler ({modules.length})
              </h2>
            </CardHeader>
            <CardContent>
              {modules.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Ingen moduler ennå
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Begynn å bygge programmet ditt ved å legge til den første modulen.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {modules.map((module, index) => (
                    <div
                      key={module.id}
                      className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                    >
                      <div className="flex-shrink-0">
                        <GripVertical className="w-5 h-5 text-gray-400" />
                      </div>

                      <div className="flex-shrink-0">
                        {getModuleIcon(module)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-1">
                          <h3 className="text-base font-medium text-gray-900 truncate">
                            {index + 1}. {module.title}
                          </h3>
                          
                          {module.is_final_quiz && (
                            <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">
                              Avsluttende quiz
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span>{module.type === 'text' ? 'Tekstmodul' : module.type === 'video' ? 'Videomodul' : 'Quiz'}</span>
                          
                          {module.content?.estimatedMinutes && (
                            <span>{module.content.estimatedMinutes} min</span>
                          )}
                          
                          {module.has_questions && (
                            <span>{module.content?.questions?.length || 0} spørsmål</span>
                          )}
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditModule(module)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteModule(module.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
