'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { CourseListItem } from '@/components/admin/programs/CourseListItem'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { EnhancedTrainingProgram, Theme } from '@/types/enhanced-database.types'
import Link from 'next/link'

export default function ProgramStructurePage() {
  const router = useRouter()
  const params = useParams()
  const themeId = params?.id as string

  const [theme, setTheme] = useState<Theme | null>(null)
  const [courses, setCourses] = useState<EnhancedTrainingProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    fetchData()
  }, [themeId])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch theme
      const { data: themeData, error: themeError } = await supabase
        .from('themes')
        .select('*')
        .eq('id', themeId)
        .single()

      if (themeError) throw themeError
      setTheme(themeData)

      // Fetch courses in this theme
      const { data: coursesData, error: coursesError } = await supabase
        .from('training_programs')
        .select('*')
        .eq('theme_id', themeId)
        .order('sort_order', { ascending: true })

      if (coursesError) throw coursesError
      setCourses(coursesData || [])
    } catch (error: any) {
      console.error('Error fetching data:', error)
      toast.error('Kunne ikke hente data: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return

    const newCourses = [...courses]
    const [removed] = newCourses.splice(draggedIndex, 1)
    newCourses.splice(index, 0, removed)

    setCourses(newCourses)
    setDraggedIndex(index)
    setHasChanges(true)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handlePrerequisiteChange = (courseId: string, type: string, courseIds?: string[]) => {
    setCourses(prevCourses =>
      prevCourses.map(course =>
        course.id === courseId
          ? {
              ...course,
              prerequisite_type: type as any,
              prerequisite_course_ids: courseIds || []
            }
          : course
      )
    )
    setHasChanges(true)
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      // Update each course with new sort_order and prerequisite settings
      const updates = courses.map((course, index) => ({
        id: course.id,
        sort_order: index,
        prerequisite_type: course.prerequisite_type || 'none',
        prerequisite_course_ids: course.prerequisite_course_ids || []
      }))

      for (const update of updates) {
        const { error } = await supabase
          .from('training_programs')
          .update({
            sort_order: update.sort_order,
            prerequisite_type: update.prerequisite_type,
            prerequisite_course_ids: update.prerequisite_course_ids
          })
          .eq('id', update.id)

        if (error) throw error
      }

      toast.success('Programstruktur lagret!')
      setHasChanges(false)
      router.refresh()
    } catch (error: any) {
      console.error('Error saving structure:', error)
      toast.error('Kunne ikke lagre: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Laster programstruktur...</p>
        </div>
      </div>
    )
  }

  if (!theme) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Program ikke funnet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Kunne ikke finne det angitte programmet.
            </p>
            <Link href="/admin/programs">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Tilbake til kurs
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/programs">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Tilbake
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Programstruktur: {theme.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Organiser rekkefølge og avhengigheter mellom kurs
            </p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          loading={saving}
        >
          <Save className="mr-2 h-4 w-4" />
          Lagre endringer
        </Button>
      </div>

      {/* Instructions */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-900/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-300 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <p className="font-medium">Slik bruker du programstrukturen:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Dra kursene for å endre rekkefølgen</li>
                <li>Velg avhengighetstype for hvert kurs</li>
                <li>"Tilgjengelig umiddelbart" - Kurset er alltid åpent</li>
                <li>"Åpnes automatisk" - Kurset låses opp når forrige er fullført</li>
                <li>"Krever godkjenning" - Du må manuelt godkjenne før kurset åpnes</li>
                <li>"Avhenger av spesifikke kurs" - Kurset åpnes når alle valgte kurs er fullført</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Course List */}
      {courses.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Ingen kurs i dette programmet ennå.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Gå til kursadministrasjonen for å legge til kurs i dette programmet.
            </p>
            <Link href="/admin/programs">
              <Button variant="primary" className="mt-4">
                Gå til kursadministrasjon
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {courses.map((course, index) => (
            <CourseListItem
              key={course.id}
              course={course}
              index={index}
              allCourses={courses}
              onPrerequisiteChange={handlePrerequisiteChange}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              isDragging={draggedIndex === index}
            />
          ))}
        </div>
      )}

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 z-50">
          <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-500/40 dark:bg-yellow-900/20 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-300" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    Du har ulagrede endringer
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Husk å lagre før du forlater siden
                  </p>
                </div>
                <Button
                  onClick={handleSave}
                  size="sm"
                  loading={saving}
                  className="ml-4"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Lagre nå
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

