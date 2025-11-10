'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, BookOpen, GripVertical } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Theme, CreateThemeFormData } from '@/types/enhanced-database.types'

interface User {
  id: string
  role: string
  company_id: string
}

export default function ThemesPage() {
  const [themes, setThemes] = useState<Theme[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null)
  const [user, setUser] = useState<User | null>(null)
  
  const [formData, setFormData] = useState<CreateThemeFormData>({
    name: '',
    description: '',
  })

  useEffect(() => {
    fetchUserAndThemes()
  }, [])

  const fetchUserAndThemes = async () => {
    try {
      // Get current user
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

      // Fetch themes for the user's company
      const { data: themesData, error } = await supabase
        .from('themes')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('order_index', { ascending: true })

      if (error) throw error
      setThemes(themesData || [])
    } catch (error: any) {
      toast.error('Kunne ikke hente temaer: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      if (editingTheme) {
        // Update existing theme
        const { error } = await supabase
          .from('themes')
          .update({
            name: formData.name,
            description: formData.description || null,
          })
          .eq('id', editingTheme.id)

        if (error) throw error
        toast.success('Tema oppdatert!')
      } else {
        // Create new theme
        const nextOrderIndex = themes.length > 0 
          ? Math.max(...themes.map(t => t.order_index)) + 1 
          : 0

        const { error } = await supabase
          .from('themes')
          .insert([{
            name: formData.name,
            description: formData.description || null,
            company_id: user.company_id,
            order_index: nextOrderIndex,
          }])

        if (error) throw error
        toast.success('Tema opprettet!')
      }

      setShowForm(false)
      setEditingTheme(null)
      setFormData({ name: '', description: '' })
      fetchUserAndThemes()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleEdit = (theme: Theme) => {
    setEditingTheme(theme)
    setFormData({
      name: theme.name,
      description: theme.description || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (themeId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette temaet? Alle tilhørende kurs vil miste tema-tilknytningen.')) return

    try {
      const { error } = await supabase
        .from('themes')
        .delete()
        .eq('id', themeId)

      if (error) throw error
      toast.success('Tema slettet!')
      fetchUserAndThemes()
    } catch (error: any) {
      toast.error('Kunne ikke slette tema: ' + error.message)
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingTheme(null)
    setFormData({ name: '', description: '' })
  }

  // Get program count for each theme
  const [programCounts, setProgramCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (themes.length > 0 && user) {
      fetchProgramCounts()
    }
  }, [themes, user])

  const fetchProgramCounts = async () => {
    if (!user) return

    try {
      const counts: Record<string, number> = {}
      
      for (const theme of themes) {
        const { count } = await supabase
          .from('training_programs')
          .select('id', { count: 'exact', head: true })
          .eq('theme_id', theme.id)
          .eq('company_id', user.company_id)
        
        counts[theme.id] = count || 0
      }

      setProgramCounts(counts)
    } catch (error: any) {
      console.error('Error fetching program counts:', error)
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
          <h1 className="text-2xl font-bold text-gray-900">Temaer</h1>
          <p className="text-gray-600">Organiser kurs i temaer for bedre struktur</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nytt tema
        </Button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <h3 className="text-lg font-semibold">
                {editingTheme ? 'Rediger tema' : 'Nytt tema'}
              </h3>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Temanavn"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  placeholder="F.eks. HMS og Sikkerhet"
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beskrivelse
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    rows={3}
                    placeholder="Valgfri beskrivelse av temaet"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <Button type="submit" className="flex-1">
                    {editingTheme ? 'Oppdater' : 'Opprett'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={resetForm}>
                    Avbryt
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Themes List */}
      <div className="grid gap-4">
        {themes.length > 0 ? (
          themes.map((theme) => (
            <Card key={theme.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="cursor-move">
                      <GripVertical className="w-5 h-5 text-gray-400" />
                    </div>
                    <BookOpen className="w-6 h-6 text-primary-600" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {theme.name}
                      </h3>
                      {theme.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {theme.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 mt-2">
                        <p className="text-xs text-gray-500">
                          {programCounts[theme.id] || 0} kurs
                        </p>
                        <p className="text-xs text-gray-500">
                          Opprettet: {new Date(theme.created_at).toLocaleDateString('no-NO')}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Link href={`/dashboard/admin/themes/${theme.id}`}>
                      <Button
                        variant="secondary"
                        size="sm"
                      >
                        Se progresjon
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(theme)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(theme.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Ingen temaer ennå
              </h3>
              <p className="text-gray-600 mb-4">
                Opprett ditt første tema for å organisere kursene
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Opprett tema
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}