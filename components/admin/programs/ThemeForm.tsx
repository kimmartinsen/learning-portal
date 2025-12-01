'use client'

import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { Topic } from '@/types/enhanced-database.types'

export interface ThemeFormData {
  name: string
  description: string
  topic_id?: string | null
  progression_type?: 'flexible' | 'sequential_auto' | 'sequential_manual'
}

interface ThemeFormProps {
  formData: ThemeFormData
  isCreating: boolean
  onSubmit: (e: React.FormEvent) => void
  onChange: (data: Partial<ThemeFormData>) => void
  onCancel: () => void
  buttonText?: string
  topics?: Topic[]
  showTopicSelector?: boolean
}

export function ThemeForm({
  formData,
  isCreating,
  onSubmit,
  onChange,
  onCancel,
  buttonText,
  topics = [],
  showTopicSelector = false
}: ThemeFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {showTopicSelector && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Tema
          </label>
          {topics.length > 0 ? (
            <select
              value={formData.topic_id || ''}
              onChange={(e) => onChange({ topic_id: e.target.value || null })}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
            >
              <option value="">Uten tema</option>
              {topics.map(topic => (
                <option key={topic.id} value={topic.id}>{topic.name}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
              Ingen temaer opprettet ennå. Opprett et tema først for å organisere programmene dine.
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Velg hvilket tema programmet skal tilhøre
          </p>
        </div>
      )}
      
      <Input
        label="Programnavn"
        value={formData.name}
        onChange={(e) => onChange({ name: e.target.value })}
        required
        placeholder="F.eks. Lederutvikling 2025"
      />
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Beskrivelse
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400"
          rows={3}
          placeholder="Beskrivelse av hva programmet inneholder..."
        />
      </div>

      <div className="flex space-x-3 pt-4">
        <Button type="submit" className="flex-1" loading={isCreating}>
          {buttonText || (isCreating ? 'Opprett program' : 'Lagre endringer')}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isCreating}>
          Avbryt
        </Button>
      </div>
    </form>
  )
}
