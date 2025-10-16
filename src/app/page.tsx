import { redirect } from 'next/navigation';
import Link from 'next/link';
import { MessageCircle, Users, Shield } from 'lucide-react';
import { createServerClientStrict } from '@/lib/supabase/server';

// Force dynamic rendering for user-specific content
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createServerClientStrict();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  // If no user, redirect to login
  if (!user || userError) redirect('/login');

  // Check if user has a profile
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  // If no profile exists, redirect to signup
  if (error || !profile) {
    redirect('/signup');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome back, {profile.display_name || 'there'}!
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            {profile.user_type === 'CREATOR' 
              ? 'Manage your content and connect with your fans'
              : 'Discover and connect with your favorite creators'
            }
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* Chat Card */}
          <Link href="/chat" className="group">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4 group-hover:bg-blue-200 transition-colors">
                <MessageCircle className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Chat</h3>
              <p className="text-gray-600 text-sm">
                {profile.user_type === 'CREATOR'
                  ? 'Connect with your fans through private messaging'
                  : 'Message creators you have access to'
                }
              </p>
            </div>
          </Link>

          {/* Dashboard Card */}
          <Link 
            href={profile.user_type === 'CREATOR' ? '/creator/dashboard' : '/fan/dashboard'} 
            className="group"
          >
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4 group-hover:bg-green-200 transition-colors">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Dashboard</h3>
              <p className="text-gray-600 text-sm">
                {profile.user_type === 'CREATOR'
                  ? 'Manage your content, earnings, and fan interactions'
                  : 'View your purchases and creator interactions'
                }
              </p>
            </div>
          </Link>

          {/* Settings Card */}
          <Link 
            href={profile.user_type === 'CREATOR' ? '/creator/settings' : '/settings'} 
            className="group"
          >
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mb-4 group-hover:bg-purple-200 transition-colors">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Settings</h3>
              <p className="text-gray-600 text-sm">
                Manage your account preferences and privacy settings
              </p>
            </div>
          </Link>
        </div>

        {/* User Info */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Information</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Email:</span>
              <span className="ml-2 font-medium">{user.email}</span>
            </div>
            <div>
              <span className="text-gray-600">User Type:</span>
              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                profile.user_type === 'CREATOR' 
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {profile.user_type}
              </span>
            </div>
            {profile.display_name && (
              <div>
                <span className="text-gray-600">Display Name:</span>
                <span className="ml-2 font-medium">{profile.display_name}</span>
              </div>
            )}
            <div>
              <span className="text-gray-600">Member Since:</span>
              <span className="ml-2 font-medium">
                {new Date(profile.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}