'use client'

import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export interface ThemeFormData {
  name: string
  description: string
  progression_type?: 'flexible' | 'sequential_auto' | 'sequential_manual'
}

interface ThemeFormProps {
  formData: ThemeFormData
  isCreating: boolean
  onSubmit: (e: React.FormEvent) => void
  onChange: (data: Partial<ThemeFormData>) => void
  onCancel: () => void
  buttonText?: string
}

export function ThemeForm({
  formData,
  isCreating,
  onSubmit,
  onChange,
  onCancel,
  buttonText
}: ThemeFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
