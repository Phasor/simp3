import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { displayName, email, profilePictureUrl, bannerImageUrl } = body

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

    // Get current profile to verify ownership
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (profileError || !currentProfile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {}
    
    if (displayName !== undefined) {
      updateData.display_name = displayName.trim()
    }
    
    if (email !== undefined) {
      updateData.email = email.trim()
    }
    
    if (profilePictureUrl !== undefined) {
      updateData.profile_picture_url = profilePictureUrl
    }
    
    if (bannerImageUrl !== undefined) {
      updateData.banner_image_url = bannerImageUrl
    }

    // Update the profile - RLS policies ensure users can only update their own profile
    // Additional security: explicitly check auth_user_id matches current user
    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', currentProfile.id)
      .eq('auth_user_id', user.id) // Extra security check
      .select()

    if (error) {
      console.error('❌ Profile update failed:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    console.log('✅ Profile updated successfully:', data)

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
