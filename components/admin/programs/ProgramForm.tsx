'use client'

import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { AssignmentSelector } from '@/components/admin/AssignmentSelector'
import type { Theme } from '@/types/enhanced-database.types'

interface ProgramFormData {
  title: string
  description: string
  themeId: string
  instructorId: string
  deadlineDays: number
  repetitionEnabled: boolean
  repetitionInterval: number
  assignment: {
    type: 'department' | 'individual'
    departmentIds: string[]
    userIds: string[]
  }
}

interface ProgramFormProps {
  formData: ProgramFormData
  themes: Theme[]
  instructors: Array<{ id: string; full_name: string }>
  companyId: string
  isEditing: boolean
  onSubmit: (e: React.FormEvent) => void
  onChange: (data: Partial<ProgramFormData>) => void
  onCancel: () => void
}

export function ProgramForm({
  formData,
  themes,
  instructors,
  companyId,
  isEditing,
  onSubmit,
  onChange,
  onCancel
}: ProgramFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input
        label="Kurstittel"
        value={formData.title}
        onChange={(e) => onChange({ title: e.target.value })}
        required
        placeholder="F.eks. Sikkerhet på arbeidsplassen"
      />
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Beskrivelse
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400"
          rows={3}
          placeholder="Beskrivelse av kurset"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Tema
        </label>
        <select
          value={formData.themeId}
          onChange={(e) => onChange({ themeId: e.target.value })}
          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
        >
          <option value="">Velg tema (valgfritt)</option>
          {themes.map(theme => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
        {themes.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            <a href="/admin/themes" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
              Opprett temaer først
            </a> for å organisere kursene
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Instruktør
        </label>
        <select
          value={formData.instructorId}
          onChange={(e) => onChange({ instructorId: e.target.value })}
          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
        >
          <option value="">Ingen instruktør</option>
          {instructors.map(instructor => (
            <option key={instructor.id} value={instructor.id}>
              {instructor.full_name}
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Frist (antall dager)"
        type="number"
        min="1"
        max="365"
        value={formData.deadlineDays}
        onChange={(e) => onChange({ deadlineDays: parseInt(e.target.value) || 14 })}
        placeholder="14"
        helper="Antall dager brukere har til å fullføre kurset"
      />

      <div>
        <label className="flex items-center mb-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={formData.repetitionEnabled}
            onChange={(e) => onChange({ repetitionEnabled: e.target.checked })}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="ml-2">Aktiver repetisjon</span>
        </label>
        
        {formData.repetitionEnabled && (
          <Input
            label="Repetisjon hver (måneder)"
            type="number"
            min="1"
            max="60"
            value={formData.repetitionInterval}
            onChange={(e) => onChange({ repetitionInterval: parseInt(e.target.value) })}
          />
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tildel kurs til
        </label>
        <AssignmentSelector
          companyId={companyId}
          onSelectionChange={(selection) => onChange({ assignment: selection })}
          initialSelection={formData.assignment}
        />
      </div>

      <div className="flex space-x-3 pt-4">
        <Button type="submit" className="flex-1">
          {isEditing ? 'Oppdater kurs' : 'Opprett kurs'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Avbryt
        </Button>
      </div>
    </form>
  )
}

