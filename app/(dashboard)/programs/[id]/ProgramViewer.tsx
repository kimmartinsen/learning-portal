'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  PlayCircle,
  CheckCircle,
  Lock,
  Calendar,
  User,
  ChevronRight
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import ModuleViewer from './ModuleViewer'

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
  is_mandatory: boolean
  deadline: string | null
  instructor?: {
    full_name: string
  } | null
  modules: Module[]
}

interface UserProgress {
  id: string
  module_id: string
  status: string
  completed_at: string | null
  questions_answered: any[]
  questions_correct: number
  questions_total: number
  score: number | null
  passed: boolean | null
}

interface Props {
  program: Program
  userProgress: UserProgress[]
  userId: string
}

export default function ProgramViewer({ program, userProgress, userId }: Props) {
  const router = useRouter()
  const [currentModuleIndex, setCurrentModuleIndex] = useState<number | null>(null)
  const [progressMap, setProgressMap] = useState<Map<string, UserProgress>>(new Map())

  useEffect(() => {
    // Create progress map for quick lookup
    const map = new Map()
    userProgress.forEach(progress => {
      map.set(progress.module_id, progress)
    })
    setProgressMap(map)
  }, [userProgress])

  // Sort modules by order_index
  const sortedModules = [...program.modules].sort((a, b) => a.order_index - b.order_index)
  
  // Calculate overall progress dynamically based on progressMap
  const totalModules = sortedModules.length
  const completedModules = sortedModules.filter(module => {
    const progress = progressMap.get(module.id)
    return progress?.status === 'completed'
  }).length
  const overallProgress = totalModules > 0 ? (completedModules / totalModules) * 100 : 0

  // Find next module to continue
  const getNextModule = () => {
    for (let i = 0; i < sortedModules.length; i++) {
      const module = sortedModules[i]
      const progress = progressMap.get(module.id)
      if (!progress || progress.status !== 'completed') {
        return i
      }
    }
    return null // All completed
  }

  const getModuleStatus = (module: Module, index: number) => {
    const progress = progressMap.get(module.id)
    
    if (progress?.status === 'completed') return 'completed'
    if (progress?.status === 'in_progress') return 'in_progress'
    
    // Check if module is unlocked
    if (index === 0) return 'available' // First module always available
    
    // Check if previous module is completed
    const prevModule = sortedModules[index - 1]
    const prevProgress = progressMap.get(prevModule.id)
    if (prevProgress?.status === 'completed') return 'available'
    
    return 'locked'
  }

  const getModuleIcon = (module: Module) => {
    const status = getModuleStatus(module, sortedModules.findIndex(m => m.id === module.id))
    
    if (status === 'completed') return <CheckCircle className="w-5 h-5 text-green-600" />
    if (status === 'locked') return <Lock className="w-5 h-5 text-gray-400" />
    
    // Available or in progress - new granular types
    if (module.is_final_quiz || module.type === 'final_quiz') return <CheckCircle className="w-5 h-5 text-yellow-600" />
    if (module.type === 'video_section') return <PlayCircle className="w-5 h-5 text-primary-600" />
    if (module.type === 'question') return <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center"><span className="text-green-600 text-xs font-bold">?</span></div>
    return <BookOpen className="w-5 h-5 text-primary-600" />
  }

  const handleModuleClick = (moduleIndex: number) => {
    const module = sortedModules[moduleIndex]
    const status = getModuleStatus(module, moduleIndex)
    
    if (status === 'locked') {
      toast.error('Du må fullføre forrige modul først')
      return
    }
    
    setCurrentModuleIndex(moduleIndex)
  }

  const handleContinue = () => {
    const nextIndex = getNextModule()
    if (nextIndex !== null) {
      setCurrentModuleIndex(nextIndex)
    }
  }

  const handleModuleComplete = async (moduleId: string, data?: any) => {
    // Refresh progress data
    try {
      const { data: newProgress, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('program_id', program.id)

      if (!error && newProgress) {
        const newMap = new Map()
        newProgress.forEach((p: UserProgress) => {
          newMap.set(p.module_id, p)
        })
        setProgressMap(newMap)

        // Check if program is completed (all modules completed AND all final quizzes passed)
        const allModulesCompleted = sortedModules.every(module => {
          const moduleProgress = newMap.get(module.id)
          if (moduleProgress?.status !== 'completed') return false
          
          // For final quiz modules, also check if they passed
          if (module.is_final_quiz && moduleProgress.passed === false) {
            return false
          }
          
          return true
        })

        if (allModulesCompleted) {
          // Go back to overview when program is complete
          setCurrentModuleIndex(null)
          toast.success('🎉 Alle deler fullført!')
          return
        }

        // Find next available module - but only auto-navigate if current module was successful
        const currentModule = sortedModules.find(m => m.id === moduleId)
        const currentProgress = newMap.get(moduleId)
        
        // Don't auto-navigate if it's a failed final quiz
        if (currentModule?.is_final_quiz && currentProgress?.passed === false) {
          // Stay on the quiz page to allow retry
          return
        }
        
        const currentIndex = sortedModules.findIndex(m => m.id === moduleId)
        const nextIndex = currentIndex + 1
        
        if (nextIndex < sortedModules.length) {
          // Auto-navigate to next module after a short delay
          setTimeout(() => {
            setCurrentModuleIndex(nextIndex)
            toast.success(`Neste: ${sortedModules[nextIndex].title}`)
          }, 800)
        } else {
          // No more modules - go back to overview
          setTimeout(() => {
            setCurrentModuleIndex(null)
            toast.success('🎉 Alle deler fullført!')
          }, 800)
        }
      }
    } catch (error) {
      console.error('Error refreshing progress:', error)
    }
  }

  // Helper function to find next available module
  const getNextModuleIndex = (startFromIndex: number) => {
    for (let i = startFromIndex; i < sortedModules.length; i++) {
      const module = sortedModules[i]
      const status = getModuleStatus(module, i)
      if (status === 'available') {
        return i
      }
    }
    return null
  }

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return null
    const date = new Date(deadline)
    const now = new Date()
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return { text: `${Math.abs(diffDays)} dager forsinket`, overdue: true }
    if (diffDays === 0) return { text: 'Frist i dag', overdue: false }
    if (diffDays === 1) return { text: 'Frist i morgen', overdue: false }
    return { text: `${diffDays} dager igjen`, overdue: false }
  }

  // If viewing a specific module
  if (currentModuleIndex !== null) {
    return (
      <ModuleViewer
        module={sortedModules[currentModuleIndex]}
        program={program}
        progress={progressMap.get(sortedModules[currentModuleIndex].id)}
        userId={userId}
        onBack={() => setCurrentModuleIndex(null)}
        onComplete={(data) => handleModuleComplete(sortedModules[currentModuleIndex].id, data)}
        moduleIndex={currentModuleIndex}
        totalModules={totalModules}
      />
    )
  }

  const deadline = formatDeadline(program.deadline)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 dark:bg-gray-900/80 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center space-x-4 mb-4">
            <Button
              variant="ghost"
              onClick={() => router.push('/my-learning')}
              className="text-gray-600 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Mine opplæringer
            </Button>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {program.title}
              </h1>
              
              <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300 mb-4">
                {program.is_mandatory && (
                  <span className="inline-flex px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                    Obligatorisk
                  </span>
                )}
                
                {deadline && (
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span className={deadline.overdue ? 'text-red-600 font-medium' : ''}>
                      Frist: {deadline.text}
                    </span>
                  </div>
                )}

                {program.instructor && (
                  <div className="flex items-center space-x-1">
                    <User className="w-4 h-4" />
                    <span>{program.instructor.full_name}</span>
                  </div>
                )}
              </div>

              {program.description && (
                <p className="text-gray-600 dark:text-gray-300 mb-4">{program.description}</p>
              )}

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Fremdrift
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {completedModules} av {totalModules} moduler fullført
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-primary-500 to-primary-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
                <div className="text-right mt-1">
                  <span className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                    {Math.round(overallProgress)}% fullført
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Continue Button */}
        {getNextModule() !== null && (
          <Card className="mb-6 bg-primary-50 border-primary-200 dark:bg-primary-950/30 dark:border-primary-900/60">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-primary-900 dark:text-primary-100 mb-1">
                    Fortsett der du slapp
                  </h3>
                  <p className="text-primary-700 dark:text-primary-300">
                    Neste: {sortedModules[getNextModule()!].title}
                  </p>
                </div>
                <Button
                  onClick={handleContinue}
                  className="bg-primary-600 hover:bg-primary-700 text-white dark:bg-primary-500 dark:hover:bg-primary-400"
                >
                  Fortsett
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modules List */}
        <Card className="bg-white dark:bg-gray-900/80 dark:border-gray-800">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">📚 Innhold</h2>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {sortedModules.map((module, index) => {
                const status = getModuleStatus(module, index)
                const progress = progressMap.get(module.id)
                const isClickable = status !== 'locked'

                return (
                  <div
                    key={module.id}
                    className={`p-6 transition-colors ${
                      isClickable 
                        ? 'hover:bg-gray-50 dark:hover:bg-gray-800/70 cursor-pointer' 
                        : 'cursor-not-allowed opacity-60'
                    }`}
                    onClick={() => isClickable && handleModuleClick(index)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        {getModuleIcon(module)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-1">
                          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 truncate">
                            {index + 1}. {module.title}
                          </h3>
                          
                          {status === 'completed' && (
                            <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full dark:bg-green-500/20 dark:text-green-200">
                              Fullført
                            </span>
                          )}
                          
                          {status === 'in_progress' && (
                            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full dark:bg-blue-500/20 dark:text-blue-200">
                              Påbegynt
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
                          {/* Type label */}
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded-full dark:bg-gray-700 dark:text-gray-200">
                            {module.type === 'content_section' ? 'Opplæringsdel' :
                             module.type === 'question' ? 'Spørsmål' :
                             module.type === 'video_section' ? 'Video' :
                             module.type === 'final_quiz' ? 'Avsluttende Quiz' :
                             module.type}
                          </span>
                          
                          {module.has_questions && module.type === 'final_quiz' && (
                            <span>
                              {module.content?.questions?.length || 0} spørsmål
                            </span>
                          )}
                          
                          {module.is_final_quiz && (
                            <span className="text-yellow-600 font-medium dark:text-yellow-300">
                              {module.content?.passingScore || 80}% krav
                            </span>
                          )}
                        </div>
                        
                        {progress?.completed_at && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Fullført: {new Date(progress.completed_at).toLocaleDateString('no-NO')}
                          </p>
                        )}
                      </div>

                      <div className="flex-shrink-0">
                        {isClickable && (
                          <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Program Stats */}
        {completedModules === totalModules && (
          <Card className="mt-6 bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800/60">
            <CardContent className="p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center dark:bg-green-500/20">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-300" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-200 mb-2">
                🎉 Gratulerer!
              </h3>
              <p className="text-green-800 dark:text-green-300 mb-4">
                Du har fullført alle moduler i dette programmet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
