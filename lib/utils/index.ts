import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { nb } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return format(new Date(date), 'dd.MM.yyyy', { locale: nb })
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), 'dd.MM.yyyy HH:mm', { locale: nb })
}

export function formatRelativeTime(date: string | Date) {
  return formatDistanceToNow(new Date(date), { 
    addSuffix: true,
    locale: nb 
  })
}

export function calculateProgress(completed: number, total: number) {
  if (total === 0) return 0
  return Math.round((completed / total) * 100)
}

export function generateInitials(name: string) {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2)
}

export function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 
    ? `${hours}t ${remainingMinutes}min`
    : `${hours}t`
}
