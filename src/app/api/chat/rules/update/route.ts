import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { minSpendCents, accessDays } = body

    if (minSpendCents === undefined || accessDays === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate values
    if (minSpendCents < 100 || minSpendCents > 100000) { // $1 to $1000
      return NextResponse.json(
        { error: 'Minimum spend must be between $1 and $1000' },
        { status: 400 }
      )
    }

    if (accessDays < 1 || accessDays > 365) { // 1 day to 1 year
      return NextResponse.json(
        { error: 'Access days must be between 1 and 365' },
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

    // Get current profile to verify it's a creator
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (profileError || !currentProfile || currentProfile.user_type !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Creator profile not found' },
        { status: 404 }
      )
    }

    // Update or insert chat rules - RLS policies ensure users can only update their own rules
    // Additional security: explicitly verify the creator_id matches current user's profile
    const { data, error } = await supabase
      .from('chat_rules')
      .upsert({
        creator_id: currentProfile.id,
        min_spend_cents: minSpendCents,
        access_days: accessDays,
        access_window_days: accessDays, // Keep these the same for now
        updated_at: new Date().toISOString()
      })
      .eq('creator_id', currentProfile.id) // Extra security check for updates
      .select()

    if (error) {
      console.error('❌ Chat rules update failed:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    console.log('✅ Chat rules updated successfully:', data)

    return NextResponse.json({ 
      success: true, 
      chatRules: data[0] 
    })

  } catch (error) {
    console.error('💥 Server-side error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
