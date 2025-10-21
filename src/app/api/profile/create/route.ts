import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userType, displayName } = body

    if (!userType || !displayName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create server-side Supabase client
    const supabase = await createClient()

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('Server-side auth error:', userError)
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    console.log('🔐 Server-side user verified:', user.id)

    // Attempt to create the profile
    const profileData = {
      auth_user_id: user.id,
      email: user.email!,
      user_type: userType,
      display_name: displayName.trim(),
      profile_picture_url: null,
      onboarding_completed: true,
    }

    console.log('📝 Server-side profile creation:', profileData)

    const { data, error } = await supabase
      .from('profiles')
      .insert(profileData)
      .select()

    if (error) {
      console.error('❌ Server-side INSERT failed:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    console.log('✅ Server-side profile created successfully:', data)

    return NextResponse.json({ 
      success: true, 
      profile: data[0] 
    })

  } catch (error) {
    console.error('💥 Server-side error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
