'use client'

import { useState, useEffect } from 'react'
import { Users, Building2, Search, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface User {
  id: string
  full_name: string
  email: string
  department_id?: string
  department?: {
    name: string
  }[] | null
}

interface Department {
  id: string
  name: string
  description?: string
  user_count?: number
}

interface AssignmentSelectorProps {
  companyId: string
  onSelectionChange: (selection: {
    type: 'department' | 'individual'
    departmentIds: string[]
    userIds: string[]
  }) => void
  initialSelection?: {
    type: 'department' | 'individual'
    departmentIds: string[]
    userIds: string[]
  }
}

export function AssignmentSelector({ 
  companyId, 
  onSelectionChange, 
  initialSelection 
}: AssignmentSelectorProps) {
  const [assignmentType, setAssignmentType] = useState<'department' | 'individual'>(
    initialSelection?.type || 'department'
  )
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(
    initialSelection?.departmentIds || []
  )
  const [selectedUsers, setSelectedUsers] = useState<string[]>(
    initialSelection?.userIds || []
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [companyId])

  useEffect(() => {
    // Notify parent of selection changes
    onSelectionChange({
      type: assignmentType,
      departmentIds: selectedDepartments,
      userIds: selectedUsers
    })
  }, [assignmentType, selectedDepartments, selectedUsers, onSelectionChange])

  const fetchData = async () => {
    try {
      const [departmentsResponse, usersResponse] = await Promise.all([
        supabase
          .from('departments')
          .select('*')
          .eq('company_id', companyId)
          .order('name'),
        supabase
          .from('profiles')
          .select(`
            id, 
            full_name, 
            email, 
            department_id,
            department:departments(name)
          `)
          .eq('company_id', companyId)
          .order('full_name')
      ])

      if (departmentsResponse.error) throw departmentsResponse.error
      if (usersResponse.error) throw usersResponse.error

      // Calculate user count for each department
      const departmentsWithCount = (departmentsResponse.data || []).map(dept => ({
        ...dept,
        user_count: (usersResponse.data || []).filter(user => user.department_id === dept.id).length
      }))

      setDepartments(departmentsWithCount)
      setUsers(usersResponse.data || [])
    } catch (error: any) {
      console.error('Error fetching assignment data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTypeChange = (type: 'department' | 'individual') => {
    setAssignmentType(type)
    // Clear selections when switching type
    setSelectedDepartments([])
    setSelectedUsers([])
    setSearchTerm('')
  }

  const toggleDepartment = (departmentId: string) => {
    setSelectedDepartments(prev => 
      prev.includes(departmentId) 
        ? prev.filter(id => id !== departmentId)
        : [...prev, departmentId]
    )
  }

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const filteredUsers = users.filter(user => 
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (Array.isArray(user.department) && user.department.length > 0
      ? user.department[0].name 
      : '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dept.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <div className="text-center py-4">Laster...</div>
  }

  return (
    <div className="space-y-4">
      {/* Assignment Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tildelingstype
        </label>
        <div className="flex space-x-2">
          <Button
            type="button"
            variant={assignmentType === 'department' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => handleTypeChange('department')}
            className="flex-1"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Avdeling
          </Button>
          <Button
            type="button"
            variant={assignmentType === 'individual' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => handleTypeChange('individual')}
            className="flex-1"
          >
            <Users className="w-4 h-4 mr-2" />
            Individuelt
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          placeholder={`Søk ${assignmentType === 'department' ? 'avdelinger' : 'brukere'}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Selection List */}
      <div className="max-h-64 overflow-y-auto border rounded-md">
        {assignmentType === 'department' ? (
          <div className="divide-y divide-gray-200">
            {filteredDepartments.length > 0 ? (
              filteredDepartments.map((department) => (
                <div
                  key={department.id}
                  className={cn(
                    "p-3 cursor-pointer hover:bg-gray-50 transition-colors",
                    selectedDepartments.includes(department.id) && "bg-primary-50"
                  )}
                  onClick={() => toggleDepartment(department.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center",
                        selectedDepartments.includes(department.id)
                          ? "bg-primary-600 border-primary-600"
                          : "border-gray-300"
                      )}>
                        {selectedDepartments.includes(department.id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <Building2 className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{department.name}</p>
                        {department.description && (
                          <p className="text-sm text-gray-500">{department.description}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">
                      {department.user_count} brukere
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">
                Ingen avdelinger funnet
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className={cn(
                    "p-3 cursor-pointer hover:bg-gray-50 transition-colors",
                    selectedUsers.includes(user.id) && "bg-primary-50"
                  )}
                  onClick={() => toggleUser(user.id)}
                >
                  <div className="flex items-center space-x-3">
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center",
                      selectedUsers.includes(user.id)
                        ? "bg-primary-600 border-primary-600"
                        : "border-gray-300"
                    )}>
                      {selectedUsers.includes(user.id) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <Users className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{user.full_name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      {Array.isArray(user.department) && user.department.length > 0 && (
                        <p className="text-xs text-gray-400">{user.department[0].name}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">
                Ingen brukere funnet
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selection Summary */}
      {(selectedDepartments.length > 0 || selectedUsers.length > 0) && (
        <Card>
          <CardContent className="p-3">
            <div className="text-sm">
              <strong>Valgt:</strong>{' '}
              {assignmentType === 'department' ? (
                <>
                  {selectedDepartments.length} avdeling(er)
                  {selectedDepartments.length > 0 && (
                    <span className="text-gray-500 ml-1">
                      ({departments
                        .filter(d => selectedDepartments.includes(d.id))
                        .reduce((sum, d) => sum + (d.user_count || 0), 0)} brukere totalt)
                    </span>
                  )}
                </>
              ) : (
                `${selectedUsers.length} bruker(e)`
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
