'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Edit2, Trash2, ClipboardCheck, CheckCircle, Clock, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Checklist } from '@/types/checklist.types'
import Link from 'next/link'

interface User {
  id: string
  role: string
  company_id: string
}

export default function ChecklistsPage() {
  const router = useRouter()
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  })

  useEffect(() => {
    fetchUserAndChecklists()
  }, [])

  const fetchUserAndChecklists = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, company_id')
        .eq('id', session.user.id)
        .single()

      if (!profile || profile.role !== 'admin') {
        toast.error('Ikke autorisert')
        return
      }

      setUser(profile)
      await fetchChecklists(profile.company_id)
    } catch (error: any) {
      console.error('Error fetching data:', error)
      toast.error('Kunne ikke hente data')
    } finally {
      setLoading(false)
    }
  }

  const fetchChecklists = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setChecklists(data || [])
    } catch (error: any) {
      console.error('Error fetching checklists:', error)
      toast.error('Kunne ikke hente sjekklister')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      if (editingChecklist) {
        const { error } = await supabase
          .from('checklists')
          .update({
            title: formData.title,
            description: formData.description || null
          })
          .eq('id', editingChecklist.id)

        if (error) throw error
        toast.success('Sjekkliste oppdatert!')
      } else {
        const { data: { session } } = await supabase.auth.getSession()
        const { data, error } = await supabase
          .from('checklists')
          .insert([{
            title: formData.title,
            description: formData.description || null,
            company_id: user.company_id,
            created_by: session?.user.id || null
          }])
          .select()
          .single()

        if (error) throw error
        toast.success('Sjekkliste opprettet!')
        
        // Redirect to edit page to add items
        if (data) {
          router.push(`/admin/checklists/${data.id}`)
          router.refresh()
          return
        }
      }

      resetForm()
      fetchChecklists(user.company_id)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleEdit = (checklist: Checklist) => {
    setEditingChecklist(checklist)
    setFormData({
      title: checklist.title,
      description: checklist.description || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (checklistId: string) => {
    if (!confirm('Er du sikker på at du vil slette denne sjekklisten?')) return

    try {
      const { error } = await supabase
        .from('checklists')
        .delete()
        .eq('id', checklistId)

      if (error) throw error
      toast.success('Sjekkliste slettet!')
      if (user) {
        fetchChecklists(user.company_id)
        router.refresh()
      }
    } catch (error: any) {
      toast.error('Kunne ikke slette sjekkliste: ' + error.message)
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingChecklist(null)
    setFormData({ title: '', description: '' })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200 dark:text-green-200 dark:bg-green-500/20 dark:border-green-500/40'
      case 'in_progress':
        return 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-200 dark:bg-blue-500/20 dark:border-blue-500/40'
      case 'cancelled':
        return 'text-gray-400 bg-gray-50 border-gray-200 dark:text-gray-500 dark:bg-gray-800 dark:border-gray-700'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:border-gray-700'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />
      case 'in_progress':
        return <Clock className="w-4 h-4" />
      case 'cancelled':
        return <XCircle className="w-4 h-4" />
      default:
        return <ClipboardCheck className="w-4 h-4" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Fullført'
      case 'in_progress':
        return 'I gang'
      case 'cancelled':
        return 'Avbrutt'
      default:
        return 'Ikke startet'
    }
  }

  if (loading) {
    return <div className="text-center py-8">Laster...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sjekklister</h1>
          <p className="text-gray-600 dark:text-gray-300">Administrer sjekklister for bedriften</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Ny sjekkliste
        </Button>
      </div>

      {/* Checklists List */}
      {checklists.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Ingen sjekklister ennå
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Opprett din første sjekkliste for å komme i gang.
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Opprett sjekkliste
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {checklists.map((checklist) => (
            <Card key={checklist.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight mb-1">
                      {checklist.title}
                    </h3>
                    {checklist.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                        {checklist.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${getStatusColor(
                      checklist.status
                    )}`}
                  >
                    {getStatusIcon(checklist.status)}
                    <span>{getStatusText(checklist.status)}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-800">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Opprettet: {new Date(checklist.created_at).toLocaleDateString('no-NO')}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/checklists/${checklist.id}`}>
                      <Button size="sm" variant="ghost" title="Åpne sjekkliste">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(checklist.id)}
                      className="text-red-600 hover:text-red-700 dark:hover:text-red-400"
                      title="Slett sjekkliste"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showForm} onClose={resetForm}>
        <Card className="w-full max-w-md bg-white dark:bg-gray-900 dark:border-gray-700">
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {editingChecklist ? 'Rediger sjekkliste' : 'Ny sjekkliste'}
            </h3>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Tittel"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
                placeholder="F.eks. Månedlig HMS-sjekk"
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Beskrivelse
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400"
                  rows={3}
                  placeholder="Beskrivelse av sjekklisten..."
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <Button type="submit" className="flex-1">
                  {editingChecklist ? 'Lagre endringer' : 'Opprett sjekkliste'}
                </Button>
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Avbryt
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </Modal>
    </div>
  )
}

