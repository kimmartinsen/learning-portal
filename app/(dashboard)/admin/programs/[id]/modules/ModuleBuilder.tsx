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
  X,
  MessageCircleQuestion,
  FileText,
  Video,
  Upload
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
  is_single_question: boolean
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

type ComponentType = 'content_section' | 'question' | 'video_section' | 'final_quiz'

export default function ModuleBuilder({ program, companyId }: Props) {
  const router = useRouter()
  const [modules, setModules] = useState<Module[]>(program.modules.sort((a, b) => a.order_index - b.order_index))
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingModule, setEditingModule] = useState<Module | null>(null)
  const [formType, setFormType] = useState<ComponentType>('content_section')
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    videoUrl: '',
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: '',
    quizTitle: '',
    passingScore: 80,
    estimatedMinutes: 5,
    questions: [] as any[]
  })

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      videoUrl: '',
      question: '',
      options: ['', '', '', ''],
      correctIndex: 0,
      explanation: '',
      quizTitle: '',
      passingScore: 80,
      estimatedMinutes: 5,
      questions: []
    })
    setEditingModule(null)
    setShowForm(false)
  }

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check file size (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
      toast.error('Video må være mindre enn 100MB')
      return
    }

    // Check file type
    if (!file.type.startsWith('video/')) {
      toast.error('Kun videofiler er tillatt')
      return
    }

    const loadingToast = toast.loading('Laster opp video...')

    try {
      const fileName = `videos/${Date.now()}-${file.name}`
      
      const { data, error } = await supabase.storage
        .from('learning-content')
        .upload(fileName, file)

      if (error) throw error

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('learning-content')
        .getPublicUrl(fileName)

      setFormData(prev => ({ ...prev, videoUrl: urlData.publicUrl }))
      
      toast.dismiss(loadingToast)
      toast.success('Video lastet opp!')
    } catch (error: any) {
      toast.dismiss(loadingToast)
      console.error('Video upload error:', error)
      toast.error('Kunne ikke laste opp video: ' + (error.message || 'Ukjent feil'))
    }
  }

  const handleAddComponent = (type: ComponentType) => {
    setFormType(type)
    resetForm()
    
    // Set default titles based on type
    if (type === 'content_section') {
      setFormData(prev => ({ ...prev, title: `Opplæringsdel ${modules.filter(m => m.type === 'content_section').length + 1}`, estimatedMinutes: 5 }))
    } else if (type === 'question') {
      setFormData(prev => ({ ...prev, title: `Spørsmål ${modules.filter(m => m.type === 'question').length + 1}`, estimatedMinutes: 2 }))
    } else if (type === 'video_section') {
      setFormData(prev => ({ ...prev, title: `Video ${modules.filter(m => m.type === 'video_section').length + 1}`, estimatedMinutes: 10 }))
    } else if (type === 'final_quiz') {
      setFormData(prev => ({ ...prev, quizTitle: 'Avsluttende Quiz', estimatedMinutes: 10 }))
    }
    
    setShowAddMenu(false)
    setShowForm(true)
  }

  const handleEditModule = (module: Module) => {
    setEditingModule(module)
    setFormType(module.type as ComponentType)
    
    if (module.type === 'content_section') {
      setFormData({
        ...formData,
        title: module.title,
        content: module.content?.text || '',
        estimatedMinutes: module.content?.estimatedMinutes || 5
      })
    } else if (module.type === 'question') {
      const question = module.content?.questions?.[0] || {}
      setFormData({
        ...formData,
        title: module.title,
        question: question.question || '',
        options: question.options || ['', '', '', ''],
        correctIndex: question.correctIndex || 0,
        explanation: question.explanation || '',
        estimatedMinutes: module.content?.estimatedMinutes || 2
      })
    } else if (module.type === 'video_section') {
      setFormData({
        ...formData,
        title: module.title,
        videoUrl: module.content?.videoUrl || '',
        estimatedMinutes: module.content?.estimatedMinutes || 10
      })
    } else if (module.type === 'final_quiz') {
      setFormData({
        ...formData,
        quizTitle: module.title,
        passingScore: module.content?.passingScore || 80,
        questions: module.content?.questions || [],
        estimatedMinutes: module.content?.estimatedMinutes || 10
      })
    }
    
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formData.title && !formData.quizTitle) {
      toast.error('Tittel er påkrevd')
      return
    }

    if (formType === 'question' && !formData.question.trim()) {
      toast.error('Spørsmål er påkrevd')
      return
    }

    if (formType === 'content_section' && !formData.content.trim()) {
      toast.error('Innhold er påkrevd')
      return
    }

    setLoading(true)

    try {
      let content: any = {}
      let title = formData.title
      let hasQuestions = false
      let isFinalQuiz = false
      let isSingleQuestion = false

      if (formType === 'content_section') {
        content = {
          type: 'content_section',
          text: formData.content,
          estimatedMinutes: formData.estimatedMinutes
        }
      } else if (formType === 'question') {
        content = {
          type: 'question',
          estimatedMinutes: formData.estimatedMinutes,
          questions: [{
            id: 'q1',
            question: formData.question,
            options: formData.options,
            correctIndex: formData.correctIndex,
            explanation: formData.explanation
          }]
        }
        hasQuestions = true
        isSingleQuestion = true
      } else if (formType === 'video_section') {
        content = {
          type: 'video_section',
          videoUrl: formData.videoUrl,
          estimatedMinutes: formData.estimatedMinutes
        }
      } else if (formType === 'final_quiz') {
        title = formData.quizTitle
        content = {
          type: 'final_quiz',
          passingScore: formData.passingScore,
          totalQuestions: formData.questions.length,
          estimatedMinutes: formData.estimatedMinutes,
          questions: formData.questions
        }
        hasQuestions = true
        isFinalQuiz = true
      }

      const moduleData = {
        title,
        description: null,
        type: formType,
        content,
        program_id: program.id,
        has_questions: hasQuestions,
        is_final_quiz: isFinalQuiz,
        is_single_question: isSingleQuestion,
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
        toast.success('Komponent oppdatert!')
      } else {
        // Create new module
        const { data, error } = await supabase
          .from('modules')
          .insert([moduleData])
          .select()
          .single()

        if (error) throw error

        setModules(prev => [...prev, data])
        toast.success('Komponent lagt til!')
      }

      resetForm()
    } catch (error: any) {
      console.error('Error saving module:', error)
      toast.error('Kunne ikke lagre: ' + (error.message || 'Ukjent feil'))
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Er du sikker på at du vil slette denne komponenten?')) return

    try {
      const { error } = await supabase
        .from('modules')
        .delete()
        .eq('id', moduleId)

      if (error) throw error

      setModules(prev => prev.filter(m => m.id !== moduleId))
      toast.success('Komponent slettet!')
    } catch (error: any) {
      console.error('Error deleting module:', error)
      toast.error('Kunne ikke slette komponent')
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'content_section': return <FileText className="w-5 h-5 text-blue-600" />
      case 'question': return <MessageCircleQuestion className="w-5 h-5 text-green-600" />
      case 'video_section': return <Video className="w-5 h-5 text-purple-600" />
      case 'final_quiz': return <Award className="w-5 h-5 text-yellow-600" />
      default: return <BookOpen className="w-5 h-5 text-gray-600" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'content_section': return 'Opplæringsdel'
      case 'question': return 'Spørsmål'
      case 'video_section': return 'Video'
      case 'final_quiz': return 'Avsluttende Quiz'
      default: return type
    }
  }

  const previewProgram = () => {
    window.open(`/programs/${program.id}`, '_blank')
  }

  const addQuizQuestion = () => {
    const newQuestion = {
      id: `q${formData.questions.length + 1}`,
      question: '',
      options: ['', '', '', ''],
      correctIndex: 0,
      explanation: ''
    }
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }))
  }

  const updateQuizQuestion = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === index ? { ...q, [field]: value } : q
      )
    }))
  }

  const removeQuizQuestion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }))
  }

  // Form component rendering
  if (showForm) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" onClick={() => resetForm()}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Tilbake
                </Button>
                <h1 className="text-xl font-semibold text-gray-900">
                  {editingModule ? 'Rediger' : 'Ny'} {getTypeLabel(formType)}
                </h1>
              </div>
              <div className="flex space-x-3">
                <Button variant="secondary" onClick={() => resetForm()}>
                  Avbryt
                </Button>
                <Button onClick={handleSave} disabled={loading}>
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Lagrer...' : 'Lagre'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Card>
            <CardContent className="p-6 space-y-6">
              {/* Content Section Form */}
              {formType === 'content_section' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tittel *
                    </label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="F.eks. Introduksjon til HMS"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Innhold *
                    </label>
                    <textarea
                      className="w-full h-64 p-3 border border-gray-300 rounded-lg resize-vertical focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      value={formData.content}
                      onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Skriv opplæringsinnholdet her...&#10;&#10;Du kan bruke:&#10;- Punktlister&#10;- **fet tekst**&#10;- *kursiv tekst*"
                    />
                    <p className="text-sm text-gray-500 mt-2">
                      Estimert lesetid: ~{Math.ceil(formData.content.split(' ').length / 200) || 1} minutter
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estimert tid (minutter)
                    </label>
                    <Input
                      type="number"
                      value={formData.estimatedMinutes}
                      onChange={(e) => setFormData(prev => ({ ...prev, estimatedMinutes: parseInt(e.target.value) || 5 }))}
                      min="1"
                    />
                  </div>
                </>
              )}

              {/* Question Form */}
              {formType === 'question' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tittel
                    </label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="F.eks. Spørsmål om brannvern"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Spørsmål *
                    </label>
                    <Input
                      value={formData.question}
                      onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                      placeholder="Skriv spørsmålet her..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Svaralternativer
                    </label>
                    <div className="space-y-2">
                      {formData.options.map((option, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name="correct-answer"
                            checked={formData.correctIndex === index}
                            onChange={() => setFormData(prev => ({ ...prev, correctIndex: index }))}
                            className="text-primary-600"
                          />
                          <Input
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...formData.options]
                              newOptions[index] = e.target.value
                              setFormData(prev => ({ ...prev, options: newOptions }))
                            }}
                            placeholder={`Alternativ ${String.fromCharCode(65 + index)}`}
                            className="flex-1"
                          />
                          <span className="text-xs text-gray-500 w-12">
                            {formData.correctIndex === index ? 'Riktig' : ''}
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
                      value={formData.explanation}
                      onChange={(e) => setFormData(prev => ({ ...prev, explanation: e.target.value }))}
                      placeholder="Forklar hvorfor dette er riktig svar..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estimert tid (minutter)
                    </label>
                    <Input
                      type="number"
                      value={formData.estimatedMinutes}
                      onChange={(e) => setFormData(prev => ({ ...prev, estimatedMinutes: parseInt(e.target.value) || 2 }))}
                      min="1"
                    />
                  </div>
                </>
              )}

              {/* Video Section Form */}
              {formType === 'video_section' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tittel *
                    </label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="F.eks. Evakueringsprosedyrer"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Video
                    </label>
                    
                    <div className="space-y-4">
                      {/* YouTube URL Option */}
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          YouTube URL
                        </label>
                        <Input
                          value={formData.videoUrl}
                          onChange={(e) => setFormData(prev => ({ ...prev, videoUrl: e.target.value }))}
                          placeholder="https://youtube.com/watch?v=... eller https://youtu.be/..."
                        />
                      </div>

                      {/* OR Divider */}
                      <div className="flex items-center my-4">
                        <div className="flex-1 border-t border-gray-300"></div>
                        <span className="px-3 text-sm text-gray-500 bg-white">ELLER</span>
                        <div className="flex-1 border-t border-gray-300"></div>
                      </div>

                      {/* Video Upload */}
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">
                          Last opp video
                        </label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <input
                            type="file"
                            accept="video/*"
                            onChange={handleVideoUpload}
                            className="hidden"
                            id="video-upload"
                          />
                          <label
                            htmlFor="video-upload"
                            className="cursor-pointer flex flex-col items-center"
                          >
                            <Video className="w-8 h-8 text-gray-400 mb-2" />
                            <span className="text-sm text-gray-600">
                              Klikk for å laste opp video
                            </span>
                            <span className="text-xs text-gray-500 mt-1">
                              MP4, MOV, AVI (maks 100MB)
                            </span>
                          </label>
                        </div>
                        {formData.videoUrl && formData.videoUrl.includes('supabase') && (
                          <p className="text-sm text-green-600 mt-2">
                            ✅ Video uploaded: {formData.videoUrl.split('/').pop()?.substring(0, 30)}...
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estimert tid (minutter)
                    </label>
                    <Input
                      type="number"
                      value={formData.estimatedMinutes}
                      onChange={(e) => setFormData(prev => ({ ...prev, estimatedMinutes: parseInt(e.target.value) || 10 }))}
                      min="1"
                    />
                  </div>
                </>
              )}

              {/* Final Quiz Form */}
              {formType === 'final_quiz' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quiz tittel
                    </label>
                    <Input
                      value={formData.quizTitle}
                      onChange={(e) => setFormData(prev => ({ ...prev, quizTitle: e.target.value }))}
                      placeholder="Avsluttende Quiz"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Kravscore for å bestå (%)
                      </label>
                      <Input
                        type="number"
                        value={formData.passingScore}
                        onChange={(e) => setFormData(prev => ({ ...prev, passingScore: parseInt(e.target.value) || 80 }))}
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
                        value={formData.estimatedMinutes}
                        onChange={(e) => setFormData(prev => ({ ...prev, estimatedMinutes: parseInt(e.target.value) || 10 }))}
                        min="1"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <label className="block text-sm font-medium text-gray-700">
                        Quiz-spørsmål ({formData.questions.length})
                      </label>
                      <Button onClick={addQuizQuestion} size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Legg til spørsmål
                      </Button>
                    </div>

                    {formData.questions.length === 0 ? (
                      <p className="text-gray-600 text-center py-8">
                        Ingen spørsmål lagt til ennå. Klikk "Legg til spørsmål" for å starte.
                      </p>
                    ) : (
                      <div className="space-y-6">
                        {formData.questions.map((question, qIndex) => (
                          <div key={qIndex} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-4">
                              <h3 className="font-medium text-gray-900">
                                Spørsmål {qIndex + 1}
                              </h3>
                              <Button
                                variant="ghost"
                                onClick={() => removeQuizQuestion(qIndex)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>

                            <div className="space-y-4">
                              <Input
                                value={question.question}
                                onChange={(e) => updateQuizQuestion(qIndex, 'question', e.target.value)}
                                placeholder="Skriv spørsmålet her..."
                              />

                              <div className="space-y-2">
                                {question.options.map((option: string, oIndex: number) => (
                                  <div key={oIndex} className="flex items-center space-x-3">
                                    <input
                                      type="radio"
                                      name={`correct-${qIndex}`}
                                      checked={question.correctIndex === oIndex}
                                      onChange={() => updateQuizQuestion(qIndex, 'correctIndex', oIndex)}
                                      className="text-primary-600"
                                    />
                                    <Input
                                      value={option}
                                      onChange={(e) => {
                                        const newOptions = [...question.options]
                                        newOptions[oIndex] = e.target.value
                                        updateQuizQuestion(qIndex, 'options', newOptions)
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

                              <Input
                                value={question.explanation || ''}
                                onChange={(e) => updateQuizQuestion(qIndex, 'explanation', e.target.value)}
                                placeholder="Forklaring (valgfri)..."
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
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
                  Bygg: {program.title}
                </h1>
                <p className="text-sm text-gray-600">
                  Legg til innhold og spørsmål del for del
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
          {/* Add Components */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Legg til komponenter</h2>
                {showAddMenu && (
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowAddMenu(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!showAddMenu ? (
                <Button onClick={() => setShowAddMenu(true)} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Legg til komponent
                </Button>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button
                    variant="secondary"
                    onClick={() => handleAddComponent('content_section')}
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                  >
                    <FileText className="w-6 h-6" />
                    <span className="text-sm">Opplæringsdel</span>
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => handleAddComponent('question')}
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                  >
                    <MessageCircleQuestion className="w-6 h-6" />
                    <span className="text-sm">Spørsmål</span>
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => handleAddComponent('video_section')}
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                  >
                    <Video className="w-6 h-6" />
                    <span className="text-sm">Video</span>
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => handleAddComponent('final_quiz')}
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                  >
                    <Award className="w-6 h-6" />
                    <span className="text-sm">Avsluttende Quiz</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Program Structure */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">
                Programstruktur ({modules.length} komponenter)
              </h2>
            </CardHeader>
            <CardContent>
              {modules.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Tomt program
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Begynn å bygge programmet ditt ved å legge til den første komponenten.
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
                        {getIcon(module.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-1">
                          <h3 className="text-base font-medium text-gray-900 truncate">
                            {index + 1}. {module.title}
                          </h3>
                          
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            {getTypeLabel(module.type)}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          {module.content?.estimatedMinutes && (
                            <span>~{module.content.estimatedMinutes} min</span>
                          )}
                          
                          {module.has_questions && (
                            <span>
                              {module.is_single_question ? '1 spørsmål' : 
                               `${module.content?.questions?.length || 0} spørsmål`}
                            </span>
                          )}

                          {module.is_final_quiz && (
                            <span className="text-yellow-600 font-medium">
                              {module.content?.passingScore}% krav
                            </span>
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