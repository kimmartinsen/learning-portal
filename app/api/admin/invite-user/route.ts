import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, fullName, role, companyId, departmentIds } = body

    // Verify the requester is an admin
    const supabase = createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', session.user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Ikke autorisert' }, { status: 403 })
    }

    // Use service role client to invite user
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get origin for redirect URL
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Invite user - they will receive an email to set their password
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName,
        role: role,
        company_id: companyId,
        department_ids: departmentIds,
      },
      redirectTo: `${origin}/set-password`,
    })

    if (inviteError) {
      console.error('Invite error:', inviteError)
      return NextResponse.json({ error: inviteError.message }, { status: 400 })
    }

    if (!inviteData.user) {
      return NextResponse.json({ error: 'Kunne ikke invitere bruker' }, { status: 400 })
    }

    // Create profile for the invited user
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([{
        id: inviteData.user.id,
        email: email,
        full_name: fullName,
        role: role,
        company_id: companyId,
      }])

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // Don't fail the whole request if profile creation fails
      // The profile might already exist or can be created on first login
    }

    // Add department associations
    if (departmentIds && departmentIds.length > 0) {
      const deptInserts = departmentIds.map((deptId: string) => ({
        user_id: inviteData.user!.id,
        department_id: deptId,
      }))
      
      const { error: deptError } = await supabaseAdmin
        .from('user_departments')
        .insert(deptInserts)
      
      if (deptError) {
        console.error('Department assignment error:', deptError)
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Invitasjon sendt',
      userId: inviteData.user.id 
    })
  } catch (error: any) {
    console.error('Invite user error:', error)
    return NextResponse.json({ error: error.message || 'Intern feil' }, { status: 500 })
  }
}

