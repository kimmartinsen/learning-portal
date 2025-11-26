'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Plus, Edit2, Trash2, Save, CheckCircle, Clock, XCircle, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Checklist, ChecklistItem } from '@/types/checklist.types'
import Link from 'next/link'

export default function ChecklistDetailPage() {
  const router = useRouter()
  const params = useParams()
  const checklistId = params?.id as string

  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null)
  const [itemFormData, setItemFormData] = useState({
    title: '',
    description: ''
  })

  useEffect(() => {
    if (checklistId) {
      fetchData()
    }
  }, [checklistId])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch checklist
      const { data: checklistData, error: checklistError } = await supabase
        .from('checklists')
        .select('*')
        .eq('id', checklistId)
        .single()

      if (checklistError) throw checklistError
      setChecklist(checklistData)

      // Fetch items
      const { data: itemsData, error: itemsError } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('checklist_id', checklistId)
        .order('order_index', { ascending: true })

      if (itemsError) throw itemsError
      setItems(itemsData || [])
    } catch (error: any) {
      console.error('Error fetching data:', error)
      toast.error('Kunne ikke hente data: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!checklistId) return

    try {
      if (editingItem) {
        const { error } = await supabase
          .from('checklist_items')
          .update({
            title: itemFormData.title,
            description: itemFormData.description || null
          })
          .eq('id', editingItem.id)

        if (error) throw error
        toast.success('Punkt oppdatert!')
      } else {
        // Get max order_index
        const maxOrder = items.length > 0 
          ? Math.max(...items.map(i => i.order_index || 0))
          : -1

        const { error } = await supabase
          .from('checklist_items')
          .insert([{
            checklist_id: checklistId,
            title: itemFormData.title,
            description: itemFormData.description || null,
            order_index: maxOrder + 1
          }])

        if (error) throw error
        toast.success('Punkt lagt til!')
      }

      resetItemForm()
      fetchData()
      router.refresh()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleItemDelete = async (itemId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette punktet?')) return

    try {
      const { error } = await supabase
        .from('checklist_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error
      toast.success('Punkt slettet!')
      fetchData()
      router.refresh()
    } catch (error: any) {
      toast.error('Kunne ikke slette punkt: ' + error.message)
    }
  }

  const handleStatusChange = async (itemId: string, newStatus: ChecklistItem['status']) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      }

      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString()
        updateData.completed_by = session?.user.id || null
      } else {
        updateData.completed_at = null
        updateData.completed_by = null
      }

      const { error } = await supabase
        .from('checklist_items')
        .update(updateData)
        .eq('id', itemId)

      if (error) throw error
      
      toast.success('Status oppdatert!')
      fetchData()
      router.refresh()
    } catch (error: any) {
      toast.error('Kunne ikke oppdatere status: ' + error.message)
    }
  }

  const handleChecklistStatusChange = async (newStatus: Checklist['status']) => {
    if (!checklist) return

    try {
      const { error } = await supabase
        .from('checklists')
        .update({ status: newStatus })
        .eq('id', checklist.id)

      if (error) throw error
      
      toast.success('Status oppdatert!')
      fetchData()
      router.refresh()
    } catch (error: any) {
      toast.error('Kunne ikke oppdatere status: ' + error.message)
    }
  }

  const resetItemForm = () => {
    setShowItemForm(false)
    setEditingItem(null)
    setItemFormData({ title: '', description: '' })
  }

  const handleEditItem = (item: ChecklistItem) => {
    setEditingItem(item)
    setItemFormData({
      title: item.title,
      description: item.description || ''
    })
    setShowItemForm(true)
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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Laster sjekkliste...</p>
        </div>
      </div>
    )
  }

  if (!checklist) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Sjekkliste ikke funnet
            </h3>
            <Link href="/admin/checklists">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Tilbake til sjekklister
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const completedItems = items.filter(i => i.status === 'completed').length
  const totalItems = items.length
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/checklists">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Tilbake
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {checklist.title}
            </h1>
            {checklist.description && (
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                {checklist.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={checklist.status}
            onChange={(e) => handleChecklistStatusChange(e.target.value as Checklist['status'])}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
          >
            <option value="not_started">Ikke startet</option>
            <option value="in_progress">I gang</option>
            <option value="completed">Fullført</option>
            <option value="cancelled">Avbrutt</option>
          </select>
        </div>
      </div>

      {/* Progress Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Fremdrift
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {completedItems} av {totalItems} punkter fullført
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {progressPercent}% fullført
          </p>
        </CardContent>
      </Card>

      {/* Items List */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Punkter ({items.length})
        </h2>
        <Button onClick={() => setShowItemForm(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Legg til punkt
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Ingen punkter i denne sjekklisten ennå.
            </p>
            <Button onClick={() => setShowItemForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Legg til første punkt
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400 mt-0.5">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.description}
                        </p>
                      )}
                      {item.completed_at && item.completed_by && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Fullført: {new Date(item.completed_at).toLocaleDateString('no-NO')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={item.status}
                      onChange={(e) => handleStatusChange(item.id, e.target.value as ChecklistItem['status'])}
                      className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                    >
                      <option value="not_started">Ikke startet</option>
                      <option value="in_progress">I gang</option>
                      <option value="completed">Fullført</option>
                      <option value="cancelled">Avbrutt</option>
                    </select>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditItem(item)}
                      title="Rediger punkt"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleItemDelete(item.id)}
                      className="text-red-600 hover:text-red-700 dark:hover:text-red-400"
                      title="Slett punkt"
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

      {/* Item Form Modal */}
      <Modal isOpen={showItemForm} onClose={resetItemForm}>
        <Card className="w-full max-w-md bg-white dark:bg-gray-900 dark:border-gray-700">
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {editingItem ? 'Rediger punkt' : 'Nytt punkt'}
            </h3>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleItemSubmit} className="space-y-4">
              <Input
                label="Tittel"
                value={itemFormData.title}
                onChange={(e) => setItemFormData(prev => ({ ...prev, title: e.target.value }))}
                required
                placeholder="F.eks. Sjekk brannslokningsapparat"
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Beskrivelse
                </label>
                <textarea
                  value={itemFormData.description}
                  onChange={(e) => setItemFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400"
                  rows={3}
                  placeholder="Beskrivelse av punktet..."
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <Button type="submit" className="flex-1">
                  {editingItem ? 'Lagre endringer' : 'Legg til punkt'}
                </Button>
                <Button type="button" variant="secondary" onClick={resetItemForm}>
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

