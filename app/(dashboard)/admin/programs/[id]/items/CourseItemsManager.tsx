'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Edit2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { CourseItem } from '@/types/enhanced-database.types'

interface Program {
  id: string
  title: string
  description: string | null
  course_type: string
  course_items?: CourseItem[]
}

interface Props {
  program: Program
  companyId: string
}

export default function CourseItemsManager({ program, companyId }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<CourseItem[]>(program.course_items || [])
  const [loading, setLoading] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState<CourseItem | null>(null)
  const [itemFormData, setItemFormData] = useState({
    title: '',
    description: ''
  })

  useEffect(() => {
    fetchItems()
  }, [program.id])

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('course_items')
        .select('*')
        .eq('program_id', program.id)
        .order('order_index', { ascending: true })

      if (error) throw error
      setItems(data || [])
    } catch (error: any) {
      console.error('Error fetching items:', error)
      toast.error('Kunne ikke hente punkter')
    }
  }

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!program.id) return

    try {
      setLoading(true)
      if (editingItem) {
        const { error } = await supabase
          .from('course_items')
          .update({
            title: itemFormData.title,
            description: itemFormData.description || null
          })
          .eq('id', editingItem.id)

        if (error) throw error
        toast.success('Punkt oppdatert!')
      } else {
        const maxOrder = items.length > 0 
          ? Math.max(...items.map(i => i.order_index || 0))
          : -1

        const { error } = await supabase
          .from('course_items')
          .insert([{
            program_id: program.id,
            title: itemFormData.title,
            description: itemFormData.description || null,
            order_index: maxOrder + 1
          }])

        if (error) throw error
        toast.success('Punkt lagt til!')
      }

      resetItemForm()
      await fetchItems()
      router.refresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleItemDelete = async (itemId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette punktet?')) return

    try {
      setLoading(true)
      const { error } = await supabase
        .from('course_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error
      toast.success('Punkt slettet!')
      await fetchItems()
      router.refresh()
    } catch (error: any) {
      toast.error('Kunne ikke slette punkt: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEditItem = (item: CourseItem) => {
    setEditingItem(item)
    setItemFormData({
      title: item.title,
      description: item.description || ''
    })
    setShowItemForm(true)
  }

  const resetItemForm = () => {
    setShowItemForm(false)
    setEditingItem(null)
    setItemFormData({ title: '', description: '' })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/admin/programs')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Tilbake til kurs
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {program.title}
          </h1>
          {program.description && (
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              {program.description}
            </p>
          )}
        </div>

        {/* Items List */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Kurspunkter
            </h2>
            <Button onClick={() => setShowItemForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Legg til punkt
            </Button>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                <p className="mb-4">Ingen punkter i dette kurset ennå.</p>
                <Button onClick={() => setShowItemForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Legg til første punkt
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <Card key={item.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                              {(item.order_index != null && item.order_index >= 0) ? item.order_index + 1 : index + 1}
                            </span>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                              {item.title}
                            </h3>
                          </div>
                          {item.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 ml-8">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditItem(item)}
                            title="Rediger punkt"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
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
          </CardContent>
        </Card>
      </div>

      {/* Item Form Modal */}
      <Modal isOpen={showItemForm} onClose={resetItemForm}>
        <Card className="w-full max-w-md bg-white dark:bg-gray-900 dark:border-gray-700">
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {editingItem ? 'Rediger punkt' : 'Nytt kurspunkt'}
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
                <Button type="submit" className="flex-1" loading={loading} disabled={loading}>
                  {editingItem ? 'Lagre endringer' : 'Legg til punkt'}
                </Button>
                <Button type="button" variant="secondary" onClick={resetItemForm} disabled={loading}>
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

