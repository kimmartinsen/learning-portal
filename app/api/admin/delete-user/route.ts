import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'Bruker-ID mangler' }, { status: 400 })
    }

    // Regular client for checking permissions
    const supabase = createServerSupabaseClient()

    // Verify the requesting user is an admin
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })
    }

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 })
    }

    // Prevent admin from deleting themselves
    if (userId === session.user.id) {
      return NextResponse.json({ error: 'Du kan ikke slette din egen konto' }, { status: 400 })
    }

    // Admin client for deleting auth user
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Delete profile first (this will cascade delete related records if set up)
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      console.error('Profile deletion error:', profileError)
      return NextResponse.json({ error: 'Kunne ikke slette brukerprofil: ' + profileError.message }, { status: 500 })
    }

    // Delete the auth user
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('Auth user deletion error:', authError)
      // Profile is already deleted, so we log this but don't fail the request
      // The auth user will be orphaned but that's better than having an inconsistent state
      return NextResponse.json({ 
        message: 'Brukerprofil slettet, men autentisering kunne ikke fjernes',
        warning: authError.message 
      }, { status: 200 })
    }

    return NextResponse.json({ message: 'Bruker slettet fullstendig' })
  } catch (error: any) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: error.message || 'En feil oppstod' }, { status: 500 })
  }
}

