'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [userType, setUserType] = useState<'CREATOR' | 'FAN' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function createProfile() {
    if (!userType) {
      setError('Please select an account type')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        setError('Authentication error. Please try signing in again.')
        router.push('/login')
        return
      }

      // Create profile with selected user type
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          auth_user_id: user.id,
          email: user.email!,
          user_type: userType,
          onboarding_completed: false
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        setError('Failed to create profile. Please try again.')
        return
      }

      // Redirect to home page
      router.push('/')
      
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Join CreatorHub</h1>
          <p className="text-lg text-gray-600">Pay to message. Unlock photos/videos inside chat.</p>
          <p className="text-sm text-blue-600 mt-2">
            Already have an account? <a href="/login" className="underline">Login</a>
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Creator Card */}
          <div 
            className={`border-2 rounded-xl p-8 cursor-pointer transition-all ${
              userType === 'CREATOR' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            onClick={() => setUserType('CREATOR')}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⭐</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">I'm a Creator</h2>
              <p className="text-gray-600">Monetize your content and engage with fans</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-green-500 mr-3">💰</span>
                Set your chat pricing
              </div>
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-yellow-500 mr-3">⚡</span>
                Send locked photos & videos
              </div>
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-purple-500 mr-3">🏆</span>
                Track your revenue
              </div>
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-blue-500 mr-3">👥</span>
                Build your fanbase
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm font-medium text-gray-900">Perfect for content creators</p>
            </div>
          </div>

          {/* Fan Card */}
          <div 
            className={`border-2 rounded-xl p-8 cursor-pointer transition-all ${
              userType === 'FAN' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            onClick={() => setUserType('FAN')}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💖</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">I'm a Fan</h2>
              <p className="text-gray-600">Support creators and unlock exclusive content</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-red-500 mr-3">❤️</span>
                Support your favorite creators
              </div>
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-yellow-500 mr-3">⚡</span>
                Unlock exclusive photos & videos
              </div>
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-blue-500 mr-3">👥</span>
                Chat directly with creators
              </div>
              <div className="flex items-center text-sm text-gray-700">
                <span className="text-purple-500 mr-3">🏆</span>
                Get exclusive access
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm font-medium text-gray-900">Perfect for fans & supporters</p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={createProfile}
            disabled={!userType || loading}
            className={`px-8 py-3 rounded-lg font-medium text-white transition-colors ${
              userType && !loading
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  )
}
