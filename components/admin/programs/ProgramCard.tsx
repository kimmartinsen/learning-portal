'use client'

import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Edit2, Trash2, BookOpen, Users, Clock, Settings } from 'lucide-react'
import type { EnhancedTrainingProgram } from '@/types/enhanced-database.types'

interface ProgramCardProps {
  program: EnhancedTrainingProgram
  onEdit: (program: EnhancedTrainingProgram) => void
  onDelete: (programId: string) => void
  onManageModules: (programId: string) => void
}

export function ProgramCard({
  program,
  onEdit,
  onDelete,
  onManageModules
}: ProgramCardProps) {
  const moduleCount = program.modules?.length || 0

  return (
    <Card key={program.id}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {program.title}
            </h3>
            {program.description && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                {program.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              {program.instructor && (
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{program.instructor.full_name}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <BookOpen className="w-4 h-4" />
                <span>{moduleCount} moduler</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>
                  {program.repetition_enabled
                    ? `Repeteres hver ${program.repetition_interval_months} mnd`
                    : 'Ingen repetisjon'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onManageModules(program.id)}
              aria-label="Administrer moduler"
              title="Administrer moduler"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(program)}
              aria-label="Rediger kurs"
              title="Rediger kurs"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(program.id)}
              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              aria-label="Slett kurs"
              title="Slett kurs"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

