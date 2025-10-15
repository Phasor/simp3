import { redirect } from 'next/navigation'
import { createServerClientStrict } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createServerClientStrict()
  const { data: { session } } = await supabase.auth.getSession()
  
  // If no session, redirect to login
  if (!session) redirect('/login')

  // Check if user has a profile
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', session.user.id)
    .single()

  // If no profile exists, redirect to signup
  if (error || !profile) {
    redirect('/signup')
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Welcome to CreatorHub ✅</h1>
      <div className="mt-4 space-y-2">
        <p><strong>Email:</strong> {session.user.email}</p>
        <p><strong>Account Type:</strong> {profile.user_type}</p>
        <p><strong>Display Name:</strong> {profile.display_name || 'Not set'}</p>
        <p><strong>Member since:</strong> {new Date(profile.created_at).toLocaleDateString()}</p>
      </div>
      <form action="/auth/signout" method="post" className="mt-6">
        <button className="rounded bg-gray-100 px-4 py-2 hover:bg-gray-200 transition-colors">
          Sign out
        </button>
      </form>
    </main>
  )
}
