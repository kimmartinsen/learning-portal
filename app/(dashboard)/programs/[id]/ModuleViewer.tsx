'use client'

import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  CheckCircle,
  X,
  BookOpen,
  PlayCircle,
  Award,
  MessageCircleQuestion
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
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
}

interface UserProgress {
  id: string
  status: string
  completed_at: string | null
  questions_answered: any[]
  questions_correct: number
  questions_total: number
  score: number | null
}

interface Props {
  module: Module
  program: Program
  progress?: UserProgress
  userId: string
  onBack: () => void
  onComplete: (data?: any) => void
  moduleIndex: number
  totalModules: number
  isInstructor?: boolean
}

interface Question {
  id: string
  question: string
  options: string[]
  correctIndex: number
  explanation?: string
}

// Helper function to convert YouTube URL to embed URL
const getYouTubeEmbedUrl = (url: string): string => {
  // Handle different YouTube URL formats
  let videoId = ''
  
  if (url.includes('youtube.com/watch?v=')) {
    videoId = url.split('v=')[1]?.split('&')[0]
  } else if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1]?.split('?')[0]
  } else if (url.includes('youtube.com/embed/')) {
    return url // Already embed format
  }
  
  return videoId ? `https://www.youtube.com/embed/${videoId}` : url
}

export default function ModuleViewer({ 
  module, 
  program, 
  progress, 
  userId, 
  onBack, 
  onComplete,
  moduleIndex,
  totalModules,
  isInstructor = false
}: Props) {
  const [questionAnswers, setQuestionAnswers] = useState<Map<string, number>>(new Map())
  const [showQuestionFeedback, setShowQuestionFeedback] = useState<Map<string, boolean>>(new Map())
  const [quizStarted, setQuizStarted] = useState(false)
  const [quizResults, setQuizResults] = useState<any>(null)
  const [hasStartedProgress, setHasStartedProgress] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)

  const content = module.content || {}
  const isContentSection = module.type === 'content_section'
  const isVideoSection = module.type === 'video_section'
  const isSingleQuestion = module.type === 'question'
  const isFinalQuiz = module.type === 'final_quiz'
  
  // Check if module is already completed
  const isAlreadyCompleted = progress?.status === 'completed'
  const isLastModule = moduleIndex === totalModules - 1

  const questions: Question[] = content.questions || []

  useEffect(() => {
    // Mark module as started when first loaded (but not for instructors)
    if (!isInstructor && !hasStartedProgress && !progress) {
      markModuleStarted()
      setHasStartedProgress(true)
    }
  }, [isInstructor])

  const markModuleStarted = async () => {
    // Don't allow instructors to change status
    if (isInstructor) {
      return
    }
    
    try {
      const { error } = await supabase
        .from('user_progress')
        .upsert([{
          user_id: userId,
          program_id: program.id,
          module_id: module.id,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          questions_answered: [],
          questions_correct: 0,
          questions_total: 0,
          score: null,
          passed: null
        }], {
          onConflict: 'user_id,module_id'
        })

      if (error) {
        console.error('Error starting module:', error)
        throw error
      }
    } catch (error) {
      console.error('Error marking module as started:', error)
    }
  }

  const markModuleCompleted = async (additionalData: any = {}) => {
    // Don't allow instructors to change status
    if (isInstructor) {
      toast.info('Du er instruktør for dette kurset. Statusen kan ikke endres.')
      return
    }
    
    try {
      const updateData = {
        user_id: userId,
        program_id: program.id,
        module_id: module.id,
        status: 'completed',
        completed_at: new Date().toISOString(),
        questions_answered: additionalData.questions_answered || [],
        questions_correct: additionalData.questions_correct || 0,
        questions_total: additionalData.questions_total || 0,
        score: additionalData.score || null,
        passed: additionalData.passed || null,
        ...additionalData
      }

      console.log('Saving progress:', updateData) // Debug log

      const { error } = await supabase
        .from('user_progress')
        .upsert([updateData], {
          onConflict: 'user_id,module_id'
        })

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      setJustCompleted(true)
      toast.success('Del fullført!')
      onComplete(updateData)
    } catch (error: any) {
      console.error('Error marking module as completed:', error)
      toast.error('Kunne ikke markere del som fullført: ' + (error.message || 'Ukjent feil'))
    }
  }

  const handleQuestionAnswer = (questionId: string, selectedIndex: number) => {
    const question = questions.find(q => q.id === questionId)
    if (!question) return

    const isCorrect = selectedIndex === question.correctIndex
    
    setQuestionAnswers(prev => new Map(prev.set(questionId, selectedIndex)))
    setShowQuestionFeedback(prev => new Map(prev.set(questionId, true)))

    // For single questions, auto-complete after showing feedback
    if (isSingleQuestion && isCorrect) {
      setTimeout(() => {
        handleModuleComplete()
      }, 1200)
    }
  }

  const handleModuleComplete = () => {
    console.log('Completing module:', module.type, module.title) // Debug log
    
    if (isFinalQuiz) {
      handleQuizComplete()
      return
    }

    // For modules with questions
    if (questions.length > 0) {
      const correctAnswers = questions.filter(q => 
        questionAnswers.get(q.id) === q.correctIndex
      ).length

      console.log('Completing module with questions:', { correctAnswers, totalQuestions: questions.length }) // Debug log

      markModuleCompleted({
        questions_answered: Array.from(questionAnswers.entries()).map(([qId, answer]) => ({
          questionId: qId,
          selectedAnswer: answer,
          correct: questions.find(q => q.id === qId)?.correctIndex === answer,
          timestamp: new Date().toISOString()
        })),
        questions_correct: correctAnswers,
        questions_total: questions.length
      })
    } else {
      // For content sections without questions
      console.log('Completing module without questions') // Debug log
      markModuleCompleted()
    }
  }

  const handleQuizComplete = async () => {
    const correctAnswers = questions.filter(q => 
      questionAnswers.get(q.id) === q.correctIndex
    ).length

    const score = Math.round((correctAnswers / questions.length) * 100)
    const passingScore = content.passingScore || 80
    const passed = score >= passingScore

    const quizData = {
      score,
      passed,
      correctAnswers,
      totalQuestions: questions.length,
      passingScore,
      answers: Array.from(questionAnswers.entries()).map(([qId, answer]) => ({
        questionId: qId,
        selectedAnswer: answer,
        correct: questions.find(q => q.id === qId)?.correctIndex === answer
      })),
      incorrectQuestions: questions.filter(q => 
        questionAnswers.get(q.id) !== q.correctIndex
      ).map(q => q.question),
      timestamp: new Date().toISOString()
    }

    console.log('Quiz completed:', quizData) // Debug log
    setQuizResults(quizData)

    // Hvis quizen er bestått, marker modulen som fullført.
    // Hvis den ikke er bestått, lagre forsøket men IKKE sett status til completed.
    if (passed) {
      markModuleCompleted({
        questions_answered: quizData.answers,
        questions_correct: correctAnswers,
        questions_total: questions.length,
        score: score,
        passed: passed
      })
    } else if (!isInstructor) {
      try {
        const updateData = {
          user_id: userId,
          program_id: program.id,
          module_id: module.id,
          status: 'in_progress',
          completed_at: null,
          questions_answered: quizData.answers,
          questions_correct: correctAnswers,
          questions_total: questions.length,
          score: score,
          passed: passed
        }

        await supabase
          .from('user_progress')
          .upsert([updateData], {
            onConflict: 'user_id,module_id'
          })

        // Oppdater progress i ProgramViewer slik at fremdriften inne i kurset matcher Min opplæring
        onComplete(updateData)
      } catch (error) {
        console.error('Error saving failed quiz attempt:', error)
      }
    }
  }

  const getModuleTypeIcon = () => {
    if (isFinalQuiz) return <Award className="w-6 h-6 text-yellow-600" />
    if (isVideoSection) return <PlayCircle className="w-6 h-6 text-purple-600" />
    if (isSingleQuestion) return <MessageCircleQuestion className="w-6 h-6 text-green-600" />
    return <BookOpen className="w-6 h-6 text-blue-600" />
  }

  const getModuleTypeLabel = () => {
    if (isFinalQuiz) return 'Avsluttende Quiz'
    if (isVideoSection) return 'Video'
    if (isSingleQuestion) return 'Spørsmål'
    return 'Opplæringsdel'
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Tilbake
              </Button>
              
              <div className="flex items-center space-x-3">
                {getModuleTypeIcon()}
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {getModuleTypeLabel()} {moduleIndex + 1} av {totalModules}
                  </div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {module.title}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
              {/* Removed estimated time display */}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Card className="bg-white shadow-lg dark:bg-gray-900 dark:border-gray-800">
          <CardContent className="p-8">
            {/* Content Section */}
            {isContentSection && (
              <div className="space-y-6">
                <div
                  className="content-html prose max-w-none break-words text-gray-900 dark:text-gray-100 prose-p:leading-relaxed prose-ul:list-disc prose-ol:list-decimal dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: content.text || '' }}
                />

                {/* Images if any */}
                {content.images && content.images.length > 0 && (
                  <div className="space-y-4">
                    {content.images.map((image: any, idx: number) => (
                      <div key={idx} className="text-center">
                        <img 
                          src={image.url} 
                          alt={image.alt || 'Bilde'} 
                          className="max-w-full h-auto rounded-lg shadow-sm mx-auto"
                        />
                        {image.caption && (
                          <p className="text-sm text-gray-600 mt-2 italic">
                            {image.caption}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Standard navigation buttons */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    {/* Show checkmark only when completed */}
                    {(isAlreadyCompleted || justCompleted) ? (
                      <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm">Lest og forstått</span>
                      </div>
                    ) : (
                      <div /> 
                    )}
                    
                    <div className="flex space-x-3">
                      <Button variant="secondary" onClick={onBack}>
                        Til oversikt
                      </Button>
                      {isAlreadyCompleted ? (
                        !isLastModule && (
                          <Button onClick={onComplete}>
                            Neste del →
                          </Button>
                        )
                      ) : (
                        <Button onClick={handleModuleComplete}>
                          Fullfør del
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Video Section */}
            {isVideoSection && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900 text-center mb-6">
                  🎥 {module.title}
                </h2>
                
                {content.videoUrl ? (
                  <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
                    {content.videoUrl.includes('youtube.com') || content.videoUrl.includes('youtu.be') ? (
                      <iframe
                        src={getYouTubeEmbedUrl(content.videoUrl)}
                        className="w-full h-full"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={module.title}
                      />
                    ) : (
                      <video
                        className="w-full h-full"
                        controls
                        preload="metadata"
                      >
                        <source src={content.videoUrl} type="video/mp4" />
                        <p className="text-center text-white p-4">
                          Din nettleser støtter ikke video-avspilling.
                        </p>
                      </video>
                    )}
                  </div>
                ) : (
                  <div className="aspect-video w-full bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <PlayCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Ingen video lagt til ennå</p>
                    </div>
                  </div>
                )}

{/* Removed estimated time display */}

                {/* Standard navigation buttons */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    {/* Show checkmark only when completed */}
                    {(isAlreadyCompleted || justCompleted) ? (
                      <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm">Video sett</span>
                      </div>
                    ) : (
                      <div />
                    )}
                    
                    <div className="flex space-x-3">
                      <Button variant="secondary" onClick={onBack}>
                        Til oversikt
                      </Button>
                      {isAlreadyCompleted ? (
                        !isLastModule && (
                          <Button onClick={onComplete}>
                            Neste del →
                          </Button>
                        )
                      ) : (
                        <Button onClick={handleModuleComplete}>
                          Marker som sett
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Single Question */}
            {isSingleQuestion && questions.length > 0 && (
              <div className="space-y-6">
                <QuestionCard
                  question={questions[0]}
                  selectedAnswer={questionAnswers.get(questions[0].id)}
                  showFeedback={showQuestionFeedback.get(questions[0].id) || false}
                  onAnswer={(index) => handleQuestionAnswer(questions[0].id, index)}
                  isFinalQuiz={false}
                />
                
                {/* Standard navigation buttons */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    {/* Show checkmark only when completed */}
                    {(isAlreadyCompleted || justCompleted) ? (
                      <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm">Spørsmål besvart</span>
                      </div>
                    ) : (
                      <div />
                    )}
                    
                    <div className="flex space-x-3">
                      <Button variant="secondary" onClick={onBack}>
                        Til oversikt
                      </Button>
                      {isAlreadyCompleted ? (
                        !isLastModule && (
                          <Button onClick={onComplete}>
                            Neste del →
                          </Button>
                        )
                      ) : (
                        questionAnswers.get(questions[0].id) !== undefined && !showQuestionFeedback.get(questions[0].id) && (
                          <Button onClick={handleModuleComplete}>
                            Fullfør spørsmål
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Final Quiz */}
            {isFinalQuiz && (
              <div className="space-y-6">
                {!quizStarted ? (
                  <div className="text-center space-y-6">
                    <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Award className="w-8 h-8 text-yellow-600" />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-gray-900">
                      📝 {module.title}
                    </h2>
                    
                    <p className="text-gray-600 max-w-2xl mx-auto">
                      Du har fullført alle delene! Nå er det tid for den avsluttende testen.
                    </p>

                    <div className="bg-blue-50 rounded-lg p-6 max-w-md mx-auto">
                      <h3 className="font-semibold text-blue-900 mb-3">📊 Krav:</h3>
                      <ul className="text-left text-blue-800 space-y-1">
                        <li>• {questions.length} spørsmål</li>
                        <li>• {content.passingScore || 80}% riktig for å bestå</li>
                        <li>• Ubegrenset antall forsøk</li>
                      </ul>
                    </div>

{/* Removed estimated time display */}

                    <Button onClick={() => setQuizStarted(true)} size="lg">
                      Start Quiz
                    </Button>
                  </div>
                ) : quizResults ? (
                  <div className="text-center space-y-6">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
                      quizResults.passed ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {quizResults.passed ? (
                        <CheckCircle className="w-8 h-8 text-green-600" />
                      ) : (
                        <X className="w-8 h-8 text-red-600" />
                      )}
                    </div>
                    
                    <h2 className="text-2xl font-bold text-gray-900">
                      {quizResults.passed ? '🎉 Gratulerer!' : '😔 Ikke bestått denne gangen'}
                    </h2>
                    
                    <div className={`rounded-lg p-6 max-w-md mx-auto ${
                      quizResults.passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      <h3 className="font-semibold text-gray-900 mb-4">📊 Detaljert Resultat:</h3>
                      <div className="text-left space-y-3">
                        <div className="flex justify-between">
                          <span>Ditt resultat:</span>
                          <span className="font-semibold">{quizResults.correctAnswers}/{quizResults.totalQuestions} ({quizResults.score}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Krav for å bestå:</span>
                          <span>{Math.ceil((quizResults.passingScore / 100) * quizResults.totalQuestions)}/{quizResults.totalQuestions} ({quizResults.passingScore}%)</span>
                        </div>
                        <div className="pt-2 border-t">
                          <div className="flex justify-between">
                            <span>Status:</span>
                            <span className={`font-semibold ${quizResults.passed ? 'text-green-600' : 'text-red-600'}`}>
                              {quizResults.passed ? '✅ BESTÅTT' : '❌ IKKE BESTÅTT'}
                            </span>
                          </div>
                        </div>
                        {!quizResults.passed && quizResults.incorrectQuestions.length > 0 && (
                          <div className="pt-2 border-t">
                            <p className="text-sm text-gray-700 mb-2">Feil på disse spørsmålene:</p>
                            <ul className="text-sm text-red-700 list-disc list-inside">
                              {quizResults.incorrectQuestions.slice(0, 3).map((q: string, i: number) => (
                                <li key={i}>{q.substring(0, 50)}...</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    {quizResults.passed ? (
                      <div className="space-y-4">
                        <Button onClick={onBack}>
                          Tilbake til program
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-gray-600 text-center">
                          Du trengte {Math.ceil((quizResults.passingScore / 100) * quizResults.totalQuestions) - quizResults.correctAnswers} flere riktige svar for å bestå.
                        </p>
                        
                        <div className="bg-blue-50 rounded-lg p-4 max-w-md mx-auto">
                          <h4 className="font-medium text-blue-900 mb-2">💡 Forslag:</h4>
                          <ul className="text-sm text-blue-800 space-y-1">
                            <li>• Gå tilbake og les gjennom materialet igjen</li>
                            <li>• Fokuser på områdene du svarte feil på</li>
                            <li>• Ta quizen på nytt når du føler deg klar</li>
                          </ul>
                        </div>

                        <div className="flex space-x-4 justify-center">
                          <Button variant="secondary" onClick={onBack}>
                            Se deler igjen  
                          </Button>
                          <Button onClick={() => {
                            setQuizResults(null)
                            setQuestionAnswers(new Map())
                            setShowQuestionFeedback(new Map())
                            setQuizStarted(false)
                          }}>
                            Prøv quiz på nytt
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // Show quiz questions
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <h2 className="text-xl font-bold text-gray-900 mb-2">
                        📝 {module.title}
                      </h2>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(questionAnswers.size / questions.length) * 100}%` }}
                        />
                      </div>
                      <p className="text-sm text-gray-600 mt-2">
                        {questionAnswers.size} av {questions.length} spørsmål besvart
                      </p>
                    </div>

                    {questions.map((question, index) => (
                      <QuestionCard
                        key={question.id}
                        question={question}
                        questionNumber={index + 1}
                        selectedAnswer={questionAnswers.get(question.id)}
                        showFeedback={false}
                        onAnswer={(answerIndex) => handleQuestionAnswer(question.id, answerIndex)}
                        isFinalQuiz={true}
                      />
                    ))}

                    {questionAnswers.size === questions.length && (
                      <div className="text-center pt-6">
                        <Button onClick={handleQuizComplete} size="lg">
                          Fullfør Quiz
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Question Card Component
function QuestionCard({ 
  question, 
  questionNumber,
  selectedAnswer, 
  showFeedback, 
  onAnswer, 
  isFinalQuiz 
}: {
  question: Question
  questionNumber?: number
  selectedAnswer?: number
  showFeedback: boolean
  onAnswer: (index: number) => void
  isFinalQuiz: boolean
}) {
  const isCorrect = selectedAnswer === question.correctIndex
  const hasAnswered = selectedAnswer !== undefined

  // Skjul tomme svaralternativer, men behold originalindeksen slik at correctIndex fortsatt stemmer
  const visibleOptions = question.options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => typeof option === 'string' && option.trim().length > 0)

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-xs font-medium text-blue-600">❓</span>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-4">
                {questionNumber && `Spørsmål ${questionNumber}: `}
                {question.question}
              </h3>

              <div className="space-y-2">
                {visibleOptions.map(({ option, index }) => (
                  <label
                    key={index}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      hasAnswered && showFeedback && !isFinalQuiz && isCorrect
                        ? index === question.correctIndex
                          ? 'border-green-500 bg-green-50'
                          : selectedAnswer === index
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-300 bg-gray-50'
                        : hasAnswered && showFeedback && !isFinalQuiz && !isCorrect
                        ? selectedAnswer === index
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-300 bg-gray-50'
                        : selectedAnswer === index
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={index}
                      checked={selectedAnswer === index}
                      onChange={() => onAnswer(index)}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 mr-3 flex-shrink-0 ${
                      selectedAnswer === index
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedAnswer === index && (
                        <div className="w-2 h-2 rounded-full bg-white mx-auto mt-0.5" />
                      )}
                    </div>
                    <span className="text-gray-900">{option}</span>
                  </label>
                ))}
              </div>

              {!hasAnswered && !isFinalQuiz && (
                <Button className="mt-4" disabled>
                  Velg et svar
                </Button>
              )}

              {hasAnswered && showFeedback && !isFinalQuiz && (
                <div className={`mt-4 p-4 rounded-lg ${
                  isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center space-x-2 mb-2">
                    {isCorrect ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="font-medium text-green-900">Riktig svar!</span>
                      </>
                    ) : (
                      <>
                        <X className="w-5 h-5 text-red-600" />
                        <span className="font-medium text-red-900">Feil svar - Prøv igjen</span>
                      </>
                    )}
                  </div>
                  {question.explanation && isCorrect && (
                    <p className="text-sm text-gray-700">
                      💡 {question.explanation}
                    </p>
                  )}
                </div>
              )}

              {/* For final quiz - only show that answer was recorded */}
              {hasAnswered && isFinalQuiz && (
                <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-900">Svar registrert</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}