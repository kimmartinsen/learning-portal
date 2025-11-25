'use client'

import { useState } from 'react'
import { GripVertical, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import type { EnhancedTrainingProgram } from '@/types/enhanced-database.types'

interface CourseListItemProps {
  course: EnhancedTrainingProgram
  index: number
  allCourses: EnhancedTrainingProgram[]
  onPrerequisiteChange: (courseId: string, type: string, courseIds?: string[]) => void
  onDragStart: (index: number) => void
  onDragOver: (index: number) => void
  onDragEnd: () => void
  isDragging: boolean
}

export function CourseListItem({
  course,
  index,
  allCourses,
  onPrerequisiteChange,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging
}: CourseListItemProps) {
  const [showPrerequisites, setShowPrerequisites] = useState(false)

  const prerequisiteType = course.prerequisite_type || 'none'
  const selectedCourseIds = course.prerequisite_course_ids || []

  const handlePrerequisiteTypeChange = (newType: string) => {
    if (newType === 'specific_courses') {
      setShowPrerequisites(true)
    } else {
      setShowPrerequisites(false)
    }
    onPrerequisiteChange(course.id, newType, [])
  }

  const handleCourseToggle = (courseId: string) => {
    const newSelection = selectedCourseIds.includes(courseId)
      ? selectedCourseIds.filter(id => id !== courseId)
      : [...selectedCourseIds, courseId]
    
    onPrerequisiteChange(course.id, 'specific_courses', newSelection)
  }

  const getPrerequisiteLabel = (type: string) => {
    switch (type) {
      case 'none':
        return 'Tilgjengelig umiddelbart'
      case 'previous_auto':
        return 'Åpnes automatisk etter forrige'
      case 'previous_manual':
        return 'Krever godkjenning etter forrige'
      case 'specific_courses':
        return 'Avhenger av spesifikke kurs'
      default:
        return 'Ukjent'
    }
  }

  const availableCourses = allCourses.filter(c => c.id !== course.id)

  return (
    <Card
      className={`mb-2 transition-all ${isDragging ? 'opacity-50' : ''}`}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver(index)
      }}
      onDragEnd={onDragEnd}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Drag Handle */}
          <button
            className="cursor-grab active:cursor-grabbing mt-1 text-gray-400 hover:text-gray-600"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-5 w-5" />
          </button>

          {/* Course Number */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700 dark:bg-primary-900 dark:text-primary-300">
            {index + 1}
          </div>

          {/* Course Info */}
          <div className="flex-1 space-y-3">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                {course.title}
              </h4>
              {course.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {course.description}
                </p>
              )}
            </div>

            {/* Prerequisite Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Avhengighet:
              </label>
              <select
                value={prerequisiteType}
                onChange={(e) => handlePrerequisiteTypeChange(e.target.value)}
                className="block w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
              >
                <option value="none">Tilgjengelig umiddelbart</option>
                <option value="previous_auto">Åpnes automatisk etter forrige kurs</option>
                <option value="previous_manual">Krever godkjenning etter forrige kurs</option>
                <option value="specific_courses">Avhenger av spesifikke kurs...</option>
              </select>

              {/* Info for each type */}
              <div className="flex items-start gap-2 rounded-md bg-blue-50 p-2 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  {prerequisiteType === 'none' && 'Kurset er alltid tilgjengelig for brukere som har fått det tildelt.'}
                  {prerequisiteType === 'previous_auto' && index > 0 && `Kurset låses opp automatisk når "${allCourses[index - 1]?.title}" er fullført.`}
                  {prerequisiteType === 'previous_auto' && index === 0 && 'Dette er første kurs, så det vil alltid være tilgjengelig.'}
                  {prerequisiteType === 'previous_manual' && index > 0 && `Når "${allCourses[index - 1]?.title}" er fullført, venter kurset på din godkjenning før det åpnes.`}
                  {prerequisiteType === 'previous_manual' && index === 0 && 'Dette er første kurs, så det vil alltid være tilgjengelig.'}
                  {prerequisiteType === 'specific_courses' && 'Velg hvilke kurs som må fullføres før dette kurset åpnes.'}
                </span>
              </div>

              {/* Specific Courses Selector */}
              {prerequisiteType === 'specific_courses' && (
                <div className="mt-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Velg kurs som må fullføres først:
                  </p>
                  {availableCourses.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Ingen andre kurs tilgjengelig i dette programmet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {availableCourses.map((availableCourse) => (
                        <label
                          key={availableCourse.id}
                          className="flex items-center gap-2 cursor-pointer hover:bg-white dark:hover:bg-gray-700 p-2 rounded transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCourseIds.includes(availableCourse.id)}
                            onChange={() => handleCourseToggle(availableCourse.id)}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {availableCourse.title}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedCourseIds.length > 0 && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                      ✓ {selectedCourseIds.length} kurs valgt. Alle må fullføres før dette kurset åpnes.
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

