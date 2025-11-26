'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Edit2, Trash2, ClipboardCheck, CheckCircle, Clock, XCircle, ChevronRight, Tag, UserPlus } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Checklist, ChecklistItem } from '@/types/checklist.types'
import { AssignmentSelector } from '@/components/admin/AssignmentSelector'
import Link from 'next/link'

interface User {
  id: string
  role: string
  company_id: string
}

export default function ChecklistsPage() {
  const router = useRouter()
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [checklistItems, setChecklistItems] = useState<Record<string, ChecklistItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null)
  const [showItemForm, setShowItemForm] = useState(false)
  const [currentChecklistId, setCurrentChecklistId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assigningChecklist, setAssigningChecklist] = useState<Checklist | null>(null)
  const [assigning, setAssigning] = useState(false)
  const [initialAssignSelection, setInitialAssignSelection] = useState<{
    departmentIds: string[]
    userIds: string[]
  }>({ departmentIds: [], userIds: [] })
  const [assignSelection, setAssignSelection] = useState<{
    type: 'department' | 'individual'
    departmentIds: string[]
    userIds: string[]
  }>({
    type: 'department',
    departmentIds: [],
    userIds: []
  })
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  })
  const [itemFormData, setItemFormData] = useState({
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

      // Fetch items for all checklists
      if (data && data.length > 0) {
        const checklistIds = data.map(c => c.id)
        const { data: itemsData, error: itemsError } = await supabase
          .from('checklist_items')
          .select('*')
          .in('checklist_id', checklistIds)
          .order('order_index', { ascending: true })

        if (itemsError) throw itemsError

        // Group items by checklist_id
        const itemsByChecklist: Record<string, ChecklistItem[]> = {}
        if (itemsData) {
          itemsData.forEach(item => {
            if (!itemsByChecklist[item.checklist_id]) {
              itemsByChecklist[item.checklist_id] = []
            }
            itemsByChecklist[item.checklist_id].push(item)
          })
        }
        setChecklistItems(itemsByChecklist)
      }
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

  const handleOpenAssign = async (checklist: Checklist) => {
    setAssigningChecklist(checklist)
    
    // Fetch existing department assignments (direkte avdelingstildelinger)
    const { data: deptAssignments } = await supabase
      .from('checklist_assignments')
      .select('assigned_to_department_id')
      .eq('checklist_id', checklist.id)
      .not('assigned_to_department_id', 'is', null)

    // Fetch existing individual assignments (ikke auto-assigned)
    const { data: userAssignments } = await supabase
      .from('checklist_assignments')
      .select('assigned_to_user_id')
      .eq('checklist_id', checklist.id)
      .not('assigned_to_user_id', 'is', null)
      .eq('is_auto_assigned', false)

    const initialDeptIds = (deptAssignments || [])
      .map(a => a.assigned_to_department_id)
      .filter((id): id is string => id !== null)

    const initialUserIds = (userAssignments || [])
      .map(a => a.assigned_to_user_id)
      .filter((id): id is string => id !== null)
    
    setInitialAssignSelection({
      departmentIds: initialDeptIds,
      userIds: initialUserIds
    })
    
    setAssignSelection({
      type: initialDeptIds.length > 0 ? 'department' : 'individual',
      departmentIds: initialDeptIds,
      userIds: initialUserIds
    })
    
    setShowAssignModal(true)
  }

  const handleAssign = async () => {
    if (!user || !assigningChecklist) return

    setAssigning(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      // Calculate current selection user IDs
      let currentUserIds: string[] = []
      
      // Get users from selected departments
      if (assignSelection.departmentIds.length > 0) {
        const { data: deptUsers, error: deptError } = await supabase
          .from('user_departments')
          .select('user_id')
          .in('department_id', assignSelection.departmentIds)

        if (deptError) throw deptError
        if (deptUsers) {
          currentUserIds = deptUsers.map(du => du.user_id)
        }
      }
      
      // Add individual users (always include them, regardless of type)
      if (assignSelection.userIds.length > 0) {
        currentUserIds = [...currentUserIds, ...assignSelection.userIds]
      }

      // Calculate initial selection user IDs
      let initialUserIds: string[] = []
      
      // Get users from initial departments
      if (initialAssignSelection.departmentIds.length > 0) {
        const { data: initialDeptUsers } = await supabase
          .from('user_departments')
          .select('user_id')
          .in('department_id', initialAssignSelection.departmentIds)

        if (initialDeptUsers) {
          initialUserIds = initialDeptUsers.map(du => du.user_id)
        }
      }
      
      // Add initial individual users
      initialUserIds = [...initialUserIds, ...initialAssignSelection.userIds]
      
      // Remove duplicates
      currentUserIds = Array.from(new Set(currentUserIds))
      initialUserIds = Array.from(new Set(initialUserIds))

      // Find users to remove (in initial but not in current)
      const currentUserIdsSet = new Set(currentUserIds)
      const usersToRemove = initialUserIds.filter(userId => !currentUserIdsSet.has(userId))

      // Find users to add (in current but not in initial)
      const initialUserIdsSet = new Set(initialUserIds)
      const usersToAdd = currentUserIds.filter(userId => !initialUserIdsSet.has(userId))

      let addedCount = 0
      let removedCount = 0

      // Remove department assignments
      const removedDepartmentIds = initialAssignSelection.departmentIds.filter(
        id => !assignSelection.departmentIds.includes(id)
      )

      if (removedDepartmentIds.length > 0) {
        // Delete department assignments (triggers will handle auto-assigned user assignments)
        const { error: deptDeleteError } = await supabase
          .from('checklist_assignments')
          .delete()
          .eq('checklist_id', assigningChecklist.id)
          .in('assigned_to_department_id', removedDepartmentIds)

        if (deptDeleteError) throw deptDeleteError
        removedCount += removedDepartmentIds.length
      }

      // Remove individual user assignments
      if (usersToRemove.length > 0) {
        // Get assignment IDs to delete (only non-auto-assigned)
        const { data: assignmentsToDelete } = await supabase
          .from('checklist_assignments')
          .select('id')
          .eq('checklist_id', assigningChecklist.id)
          .in('assigned_to_user_id', usersToRemove)
          .eq('is_auto_assigned', false)

        if (assignmentsToDelete && assignmentsToDelete.length > 0) {
          const assignmentIds = assignmentsToDelete.map(a => a.id)

          // Delete item statuses first (due to foreign key)
          await supabase
            .from('checklist_item_status')
            .delete()
            .in('assignment_id', assignmentIds)

          // Delete assignments
          const { error: deleteError } = await supabase
            .from('checklist_assignments')
            .delete()
            .in('id', assignmentIds)

          if (deleteError) throw deleteError
          removedCount += assignmentsToDelete.length
        }
      }

      // Add new department assignments
      const addedDepartmentIds = assignSelection.departmentIds.filter(
        id => !initialAssignSelection.departmentIds.includes(id)
      )

      if (addedDepartmentIds.length > 0) {
        const deptAssignmentsToCreate = addedDepartmentIds.map(deptId => ({
          checklist_id: assigningChecklist.id,
          assigned_to_department_id: deptId,
          assigned_by: session?.user.id || null,
          is_auto_assigned: false
        }))

        const { error: deptInsertError } = await supabase
          .from('checklist_assignments')
          .insert(deptAssignmentsToCreate)

        if (deptInsertError) throw deptInsertError

        // Trigger will automatically create user assignments and item statuses
        addedCount += addedDepartmentIds.length
      }

      // Add new individual user assignments
      if (usersToAdd.length > 0) {
        const assignmentsToCreate = usersToAdd.map(userId => ({
          checklist_id: assigningChecklist.id,
          assigned_to_user_id: userId,
          assigned_by: session?.user.id || null,
          is_auto_assigned: false
        }))

        const { error: insertError } = await supabase
          .from('checklist_assignments')
          .insert(assignmentsToCreate)

        if (insertError) throw insertError

        // Create item statuses for new assignments
        const items = checklistItems[assigningChecklist.id] || []
        if (items.length > 0) {
          const { data: newAssignments } = await supabase
            .from('checklist_assignments')
            .select('id')
            .eq('checklist_id', assigningChecklist.id)
            .in('assigned_to_user_id', usersToAdd)
            .eq('is_auto_assigned', false)

          if (newAssignments && newAssignments.length > 0) {
            const itemStatuses = newAssignments.flatMap(assignment =>
              items.map(item => ({
                assignment_id: assignment.id,
                item_id: item.id,
                status: 'not_started' as const
              }))
            )

            await supabase
              .from('checklist_item_status')
              .insert(itemStatuses)
          }
        }

        addedCount += usersToAdd.length
      }

      // Show success message
      if (addedCount > 0 && removedCount > 0) {
        toast.success(`${addedCount} bruker(e) tildelt, ${removedCount} fjernet`)
      } else if (addedCount > 0) {
        toast.success(`${addedCount} bruker(e) tildelt sjekkliste!`)
      } else if (removedCount > 0) {
        toast.success(`${removedCount} tildeling(er) fjernet`)
      } else {
        toast.info('Ingen endringer')
      }

      setShowAssignModal(false)
      setAssigningChecklist(null)
      setInitialAssignSelection({ departmentIds: [], userIds: [] })
      setAssignSelection({ type: 'department', departmentIds: [], userIds: [] })
      if (user) {
        await fetchChecklists(user.company_id)
        router.refresh()
      }
    } catch (error: any) {
      console.error('Assignment error:', error)
      toast.error('Kunne ikke oppdatere tildelinger: ' + error.message)
    } finally {
      setAssigning(false)
    }
  }

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentChecklistId) return

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
        const items = checklistItems[currentChecklistId] || []
        const maxOrder = items.length > 0 
          ? Math.max(...items.map(i => i.order_index || 0))
          : -1

        const { error } = await supabase
          .from('checklist_items')
          .insert([{
            checklist_id: currentChecklistId,
            title: itemFormData.title,
            description: itemFormData.description || null,
            order_index: maxOrder + 1
          }])

        if (error) throw error
        toast.success('Punkt lagt til!')
      }

      resetItemForm()
      if (user) {
        await fetchChecklists(user.company_id)
        router.refresh()
      }
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleEditItem = (item: ChecklistItem) => {
    setEditingItem(item)
    setItemFormData({
      title: item.title,
      description: item.description || ''
    })
    setCurrentChecklistId(item.checklist_id)
    setShowItemForm(true)
  }

  const handleDeleteItem = async (itemId: string, checklistId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette punktet?')) return

    try {
      const { error } = await supabase
        .from('checklist_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error
      toast.success('Punkt slettet!')
      if (user) {
        await fetchChecklists(user.company_id)
        router.refresh()
      }
    } catch (error: any) {
      toast.error('Kunne ikke slette punkt: ' + error.message)
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingChecklist(null)
    setFormData({ title: '', description: '' })
  }

  const resetItemForm = () => {
    setShowItemForm(false)
    setEditingItem(null)
    setCurrentChecklistId(null)
    setItemFormData({ title: '', description: '' })
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

      {/* Checklists List - Similar to Programs page */}
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
        <div className="space-y-4">
          {checklists.map((checklist) => {
            const items = checklistItems[checklist.id] || []
            
            return (
              <details
                key={checklist.id}
                className="group rounded-lg border border-gray-200 bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100 list-none [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-gray-500 transition-transform duration-200 group-open:rotate-90" />
                    <Tag className="h-4 w-4 text-primary-600" />
                    <span className="text-base font-semibold">{checklist.title}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ({items.length} punkter)
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCurrentChecklistId(checklist.id)
                        setShowItemForm(true)
                      }}
                      className="h-7 text-xs"
                      title="Legg til sjekkpunkt"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Legg til sjekkpunkt
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenAssign(checklist)}
                      className="h-7 text-xs"
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      Tildel sjekkliste
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(checklist)}
                      title="Rediger sjekkliste"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(checklist.id)}
                      className="text-red-600 hover:text-red-700 dark:hover:text-red-400"
                      title="Slett sjekkliste"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </summary>

                <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-4">
                  {items.length === 0 ? (
                    <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      Ingen punkter i denne sjekklisten ennå.
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {items.map((item, index) => (
                        <Card key={item.id}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                    {(item.order_index != null && item.order_index >= 0) ? item.order_index + 1 : index + 1}
                                  </span>
                                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                                    {item.title}
                                  </h3>
                                </div>

                                {item.description && (
                                  <p className="text-sm text-gray-600 dark:text-gray-300">{item.description}</p>
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
                                  onClick={() => handleDeleteItem(item.id, item.checklist_id)}
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
                </div>
              </details>
            )
          })}
        </div>
      )}

      {/* Create/Edit Checklist Modal */}
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

      {/* Item Form Modal */}
      <Modal isOpen={showItemForm} onClose={resetItemForm}>
        <Card className="w-full max-w-md bg-white dark:bg-gray-900 dark:border-gray-700">
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {editingItem ? 'Rediger punkt' : 'Nytt sjekkpunkt'}
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
      {user && assigningChecklist && (
        <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)}>
          <Card className="w-full max-w-2xl bg-white dark:bg-gray-900 dark:border-gray-700">
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Tildel sjekkliste: {assigningChecklist.title}
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
                <Button onClick={handleAssign} className="flex-1" loading={assigning} disabled={assigning}>
                  Lagre tildelinger
                </Button>
                <Button variant="secondary" onClick={() => setShowAssignModal(false)} disabled={assigning}>
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

