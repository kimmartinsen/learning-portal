'use client'

import { useState, useEffect } from 'react'
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle, 
  X,
  Clock,
  BookOpen,
  PlayCircle,
  Award
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
}

interface Program {
  id: string
  title: string
}

interface UserProgress {
  id: string
  status: string
  completed_at: string | null
  time_spent_minutes: number
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
}

interface Question {
  id: string
  question: string
  options: string[]
  correctIndex: number
  explanation?: string
}

export default function ModuleViewer({ 
  module, 
  program, 
  progress, 
  userId, 
  onBack, 
  onComplete,
  moduleIndex,
  totalModules 
}: Props) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [startTime] = useState(Date.now())
  const [questionAnswers, setQuestionAnswers] = useState<Map<string, number>>(new Map())
  const [showQuestionFeedback, setShowQuestionFeedback] = useState<Map<string, boolean>>(new Map())
  const [quizStarted, setQuizStarted] = useState(false)
  const [quizResults, setQuizResults] = useState<any>(null)
  const [hasStartedProgress, setHasStartedProgress] = useState(false)

  const content = module.content || {}
  const isTextModule = module.type === 'text'
  const isVideoModule = module.type === 'video'
  const isFinalQuiz = module.is_final_quiz

  // For text modules, create slides from content
  const slides = isTextModule && content.text ? 
    content.text.split('\n\n').filter((slide: string) => slide.trim()) : []

  const totalSlides = isTextModule ? slides.length : 1
  const questions: Question[] = content.questions || []

  useEffect(() => {
    // Mark module as started when first loaded
    if (!hasStartedProgress && !progress) {
      markModuleStarted()
      setHasStartedProgress(true)
    }
  }, [])

  const markModuleStarted = async () => {
    try {
      const { error } = await supabase
        .from('user_progress')
        .upsert([{
          user_id: userId,
          program_id: program.id,
          module_id: module.id,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          time_spent_minutes: 0
        }])

      if (error) throw error
    } catch (error) {
      console.error('Error marking module as started:', error)
    }
  }

  const markModuleCompleted = async (additionalData = {}) => {
    try {
      const timeSpent = Math.round((Date.now() - startTime) / 60000) // minutes
      
      const updateData = {
        user_id: userId,
        program_id: program.id,
        module_id: module.id,
        status: 'completed',
        completed_at: new Date().toISOString(),
        time_spent_minutes: (progress?.time_spent_minutes || 0) + timeSpent,
        ...additionalData
      }

      const { error } = await supabase
        .from('user_progress')
        .upsert([updateData])

      if (error) throw error
      
      toast.success('Modul fullført!')
      onComplete(updateData)
    } catch (error: any) {
      console.error('Error marking module as completed:', error)
      toast.error('Kunne ikke markere modul som fullført')
    }
  }

  const handleQuestionAnswer = (questionId: string, selectedIndex: number) => {
    const question = questions.find(q => q.id === questionId)
    if (!question) return

    const isCorrect = selectedIndex === question.correctIndex
    
    setQuestionAnswers(prev => new Map(prev.set(questionId, selectedIndex)))
    setShowQuestionFeedback(prev => new Map(prev.set(questionId, true)))

    // Auto-advance after showing feedback (for inline questions)
    if (!isFinalQuiz && isCorrect) {
      setTimeout(() => {
        if (currentSlide < totalSlides - 1) {
          setCurrentSlide(currentSlide + 1)
        } else {
          handleModuleComplete()
        }
      }, 2000)
    }
  }

  const handleModuleComplete = () => {
    if (isFinalQuiz) {
      handleQuizComplete()
      return
    }

    // For text/video modules with questions
    if (questions.length > 0) {
      const correctAnswers = questions.filter(q => 
        questionAnswers.get(q.id) === q.correctIndex
      ).length

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
      markModuleCompleted()
    }
  }

  const handleQuizComplete = () => {
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
      answers: Array.from(questionAnswers.entries()).map(([qId, answer]) => ({
        questionId: qId,
        selectedAnswer: answer,
        correct: questions.find(q => q.id === qId)?.correctIndex === answer
      })),
      timestamp: new Date().toISOString()
    }

    setQuizResults(quizData)

    markModuleCompleted({
      questions_answered: quizData.answers,
      questions_correct: correctAnswers,
      questions_total: questions.length,
      score: score,
      passed: passed
    })
  }

  const renderTextSlide = (slideContent: string, slideIndex: number) => {
    // Find questions for this slide
    const slideQuestions = questions.filter(q => 
      q.id.includes(`slide${slideIndex}`) || questions.length <= totalSlides
    )

    return (
      <div className="space-y-6">
        {/* Slide Content */}
        <div className="prose max-w-none">
          <div className="whitespace-pre-wrap text-gray-900 leading-relaxed">
            {slideContent}
          </div>
        </div>

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

        {/* Questions for this slide */}
        {slideQuestions.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            selectedAnswer={questionAnswers.get(question.id)}
            showFeedback={showQuestionFeedback.get(question.id) || false}
            onAnswer={(index) => handleQuestionAnswer(question.id, index)}
            isFinalQuiz={false}
          />
        ))}

        {/* Reading confirmation */}
        <div className="pt-6 border-t border-gray-200">
          <div className="flex items-center space-x-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm">Lest og forstått</span>
          </div>
        </div>
      </div>
    )
  }

  const renderVideoModule = () => {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            🎥 {module.title}
          </h2>
          
          <div className="bg-gray-100 rounded-lg p-8 mb-6">
            <PlayCircle className="w-16 h-16 text-primary-600 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Video kommer snart!</p>
            <p className="text-sm text-gray-500">
              Varighet: {content.estimatedMinutes} minutter
            </p>
          </div>

          <Button onClick={handleModuleComplete} className="mb-6">
            Marker som sett
          </Button>
        </div>

        {/* Questions after video */}
        {questions.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            selectedAnswer={questionAnswers.get(question.id)}
            showFeedback={showQuestionFeedback.get(question.id) || false}
            onAnswer={(index) => handleQuestionAnswer(question.id, index)}
            isFinalQuiz={false}
          />
        ))}
      </div>
    )
  }

  const renderFinalQuiz = () => {
    if (!quizStarted) {
      return (
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Award className="w-8 h-8 text-yellow-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900">
            📝 Avsluttende Quiz
          </h2>
          
          <p className="text-gray-600 max-w-2xl mx-auto">
            Du har fullført alle modulene! Nå er det tid for den avsluttende testen.
          </p>

          <div className="bg-blue-50 rounded-lg p-6 max-w-md mx-auto">
            <h3 className="font-semibold text-blue-900 mb-3">📊 Krav:</h3>
            <ul className="text-left text-blue-800 space-y-1">
              <li>• {questions.length} spørsmål</li>
              <li>• {content.passingScore || 80}% riktig for å bestå</li>
              <li>• Ubegrenset antall forsøk</li>
            </ul>
          </div>

          <div className="flex items-center justify-center space-x-2 text-gray-600">
            <Clock className="w-4 h-4" />
            <span>Estimert tid: {content.estimatedMinutes || 10} minutter</span>
          </div>

          <Button onClick={() => setQuizStarted(true)} size="lg">
            Start Quiz
          </Button>
        </div>
      )
    }

    if (quizResults) {
      return (
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
          
          <div className="bg-gray-50 rounded-lg p-6 max-w-md mx-auto">
            <h3 className="font-semibold text-gray-900 mb-3">📊 Resultat:</h3>
            <div className="text-left space-y-2">
              <p>• {quizResults.correctAnswers} av {quizResults.totalQuestions} riktige svar ({quizResults.score}%)</p>
              <p>• Krav: {Math.ceil((content.passingScore || 80) / 100 * questions.length)} av {questions.length} ({content.passingScore || 80}%)</p>
            </div>
          </div>

          {quizResults.passed ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-2 text-yellow-600">
                <Award className="w-6 h-6" />
                <span className="font-medium">Badge opptjent!</span>
              </div>
              <Button onClick={onBack}>
                Tilbake til program
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-600">
                Du trengte {Math.ceil((content.passingScore || 80) / 100 * questions.length) - quizResults.correctAnswers} flere riktige svar for å bestå.
              </p>
              <div className="flex space-x-4 justify-center">
                <Button variant="secondary" onClick={onBack}>
                  Se moduler igjen
                </Button>
                <Button onClick={() => {
                  setQuizResults(null)
                  setQuestionAnswers(new Map())
                  setShowQuestionFeedback(new Map())
                }}>
                  Prøv quiz på nytt
                </Button>
              </div>
            </div>
          )}
        </div>
      )
    }

    // Show quiz questions
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            📝 Avsluttende Quiz
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
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Tilbake
              </Button>
              
              <div className="text-sm text-gray-600">
                Modul {moduleIndex + 1}: {module.title}
              </div>
            </div>

            {!isFinalQuiz && (
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                {isTextModule && (
                  <>
                    <span>Slide {currentSlide + 1} av {totalSlides}</span>
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${((currentSlide + 1) / totalSlides) * 100}%` }}
                      />
                    </div>
                  </>
                )}
                
                {content.estimatedMinutes && (
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>~{content.estimatedMinutes} min</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Card>
          <CardContent className="p-8">
            {isFinalQuiz ? (
              renderFinalQuiz()
            ) : isVideoModule ? (
              renderVideoModule()
            ) : isTextModule ? (
              renderTextSlide(slides[currentSlide] || '', currentSlide)
            ) : (
              <div className="text-center">
                <p className="text-gray-600">Ukjent modultype</p>
              </div>
            )}

            {/* Navigation for text modules */}
            {isTextModule && !isFinalQuiz && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                <Button
                  variant="secondary"
                  onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                  disabled={currentSlide === 0}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Forrige
                </Button>

                {currentSlide < totalSlides - 1 ? (
                  <Button
                    onClick={() => setCurrentSlide(currentSlide + 1)}
                  >
                    Neste
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button onClick={handleModuleComplete}>
                    Fullfør modul
                  </Button>
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
                {question.options.map((option, index) => (
                  <label
                    key={index}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      hasAnswered && showFeedback
                        ? index === question.correctIndex
                          ? 'border-green-500 bg-green-50'
                          : selectedAnswer === index
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
                  {question.explanation && (
                    <p className="text-sm text-gray-700">
                      💡 {question.explanation}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
