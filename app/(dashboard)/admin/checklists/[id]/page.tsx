'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Plus, Edit2, Trash2, Users, CheckCircle, Clock, XCircle, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Checklist, ChecklistItem, ChecklistAssignment, ChecklistItemStatus } from '@/types/checklist.types'
import { AssignmentSelector } from '@/components/admin/AssignmentSelector'
import Link from 'next/link'

export default function ChecklistDetailPage() {
  const router = useRouter()
  const params = useParams()
  const checklistId = params?.id as string

  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [assignments, setAssignments] = useState<ChecklistAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; company_id: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'items' | 'assignments'>('items')
  const [showItemForm, setShowItemForm] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null)
  const [itemFormData, setItemFormData] = useState({
    title: '',
    description: ''
  })
  const [assignSelection, setAssignSelection] = useState<{
    type: 'department' | 'individual'
    departmentIds: string[]
    userIds: string[]
  }>({
    type: 'department',
    departmentIds: [],
    userIds: []
  })

  useEffect(() => {
    if (checklistId) {
      fetchUserAndData()
    }
  }, [checklistId])

  const fetchUserAndData = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, company_id, role')
        .eq('id', session.user.id)
        .single()

      if (!profile || profile.role !== 'admin') {
        toast.error('Ikke autorisert')
        return
      }

      setUser(profile)
      await fetchData(profile.company_id)
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('Kunne ikke hente data')
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async (companyId: string) => {
    try {
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

      // Fetch assignments with user info
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('checklist_assignments')
        .select(`
          *,
          assigned_to_user:profiles!checklist_assignments_assigned_to_user_id_fkey(id, full_name, email)
        `)
        .eq('checklist_id', checklistId)
        .order('assigned_at', { ascending: false })

      if (assignmentsError) throw assignmentsError
      setAssignments(assignmentsData?.map(a => ({
        ...a,
        assigned_to_user: Array.isArray(a.assigned_to_user) ? a.assigned_to_user[0] : a.assigned_to_user
      })) || [])
    } catch (error: any) {
      console.error('Error fetching data:', error)
      toast.error('Kunne ikke hente data: ' + error.message)
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
      if (user) await fetchData(user.company_id)
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
      if (user) await fetchData(user.company_id)
      router.refresh()
    } catch (error: any) {
      toast.error('Kunne ikke slette punkt: ' + error.message)
    }
  }

  const handleAssign = async () => {
    if (!user || !checklistId) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      let userIds: string[] = []

      // If department assignment, get all users in those departments
      if (assignSelection.type === 'department' && assignSelection.departmentIds.length > 0) {
        const { data: deptUsers, error: deptError } = await supabase
          .from('user_departments')
          .select('user_id')
          .in('department_id', assignSelection.departmentIds)

        if (deptError) {
          console.error('Error fetching department users:', deptError)
          throw deptError
        }

        if (deptUsers && deptUsers.length > 0) {
          userIds = deptUsers.map(du => du.user_id)
        } else {
          toast.error('Ingen brukere funnet i valgte avdeling(er)')
          return
        }
      } else if (assignSelection.type === 'individual') {
        userIds = assignSelection.userIds
      }

      if (userIds.length === 0) {
        toast.error('Velg minst én bruker eller avdeling')
        return
      }

      // Check for existing assignments to avoid duplicates
      const { data: existingAssignments } = await supabase
        .from('checklist_assignments')
        .select('assigned_to_user_id')
        .eq('checklist_id', checklistId)
        .in('assigned_to_user_id', userIds)

      const existingUserIds = new Set(
        (existingAssignments || []).map(a => a.assigned_to_user_id)
      )

      // Filter out users that already have this checklist assigned
      const newUserIds = userIds.filter(userId => !existingUserIds.has(userId))

      if (newUserIds.length === 0) {
        toast.info('Alle valgte brukere har allerede fått denne sjekklisten tildelt')
        setShowAssignModal(false)
        return
      }

      // Create assignments for new users only
      const assignmentsToCreate = newUserIds.map(userId => ({
        checklist_id: checklistId,
        assigned_to_user_id: userId,
        assigned_by: session?.user.id || null
      }))

      const { error: insertError } = await supabase
        .from('checklist_assignments')
        .insert(assignmentsToCreate)

      if (insertError) throw insertError

      // Create item statuses for each new assignment
      if (items.length > 0 && newUserIds.length > 0) {
        // Get the newly created assignments
        const { data: newAssignments, error: fetchError } = await supabase
          .from('checklist_assignments')
          .select('id')
          .eq('checklist_id', checklistId)
          .in('assigned_to_user_id', newUserIds)

        if (fetchError) throw fetchError

        if (newAssignments && newAssignments.length > 0) {
          const itemStatuses = newAssignments.flatMap(assignment =>
            items.map(item => ({
              assignment_id: assignment.id,
              item_id: item.id,
              status: 'not_started' as const
            }))
          )

          const { error: statusError } = await supabase
            .from('checklist_item_status')
            .insert(itemStatuses)

          if (statusError) throw statusError
        }
      }

      const skippedCount = userIds.length - newUserIds.length
      if (skippedCount > 0) {
        toast.success(`${newUserIds.length} bruker(e) tildelt! ${skippedCount} hadde allerede sjekklisten.`)
      } else {
        toast.success(`${newUserIds.length} bruker(e) tildelt sjekkliste!`)
      }

      setShowAssignModal(false)
      setAssignSelection({ type: 'department', departmentIds: [], userIds: [] })
      if (user) await fetchData(user.company_id)
      router.refresh()
    } catch (error: any) {
      console.error('Assignment error:', error)
      toast.error('Kunne ikke tildele: ' + error.message)
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

  if (!checklist || !user) {
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
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('items')}
            className={`
              flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors
              ${activeTab === 'items'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            <ClipboardCheck className="h-4 w-4" />
            Punkter ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`
              flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors
              ${activeTab === 'assignments'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            <Users className="h-4 w-4" />
            Tildelinger ({assignments.length})
          </button>
        </nav>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'items' ? (
        /* Items Tab */
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Punkter
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
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
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
        </>
      ) : (
        /* Assignments Tab */
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Tildelinger
            </h2>
            <Button onClick={() => setShowAssignModal(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Tildel brukere
            </Button>
          </div>

          {assignments.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Ingen brukere er tildelt denne sjekklisten ennå.
                </p>
                <Button onClick={() => setShowAssignModal(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Tildel brukere
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {assignments.map((assignment) => {
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

                    return (
                      <div key={assignment.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100">
                              {assignment.assigned_to_user?.full_name || 'Ukjent bruker'}
                            </h3>
                            {assignment.assigned_to_user?.email && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                                {assignment.assigned_to_user.email}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Tildelt: {new Date(assignment.assigned_at).toLocaleDateString('no-NO')}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusColor(
                              assignment.status
                            )}`}
                          >
                            {getStatusText(assignment.status)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
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

      {/* Assign Modal */}
      {user && (
        <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)}>
          <Card className="w-full max-w-2xl bg-white dark:bg-gray-900 dark:border-gray-700">
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Tildel sjekkliste: {checklist.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Velg brukere eller avdelinger som skal få denne sjekklisten tildelt.
              </p>
            </CardHeader>
            <CardContent>
              <AssignmentSelector
                companyId={user.company_id}
                onSelectionChange={setAssignSelection}
                selection={assignSelection}
              />
              <div className="flex space-x-3 pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
                <Button onClick={handleAssign} className="flex-1">
                  Tildel sjekkliste
                </Button>
                <Button variant="secondary" onClick={() => setShowAssignModal(false)}>
                  Avbryt
                </Button>
              </div>
            </CardContent>
          </Card>
        </Modal>
      )}
    </div>
  )
}

