'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { ArrowLeft, CreditCard, Shield, Clock } from 'lucide-react';

export default function PaymentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, profile } = useAuth();
  
  const creatorId = searchParams.get('creator');
  const amount = searchParams.get('amount');
  const days = searchParams.get('days');
  
  const [creatorInfo, setCreatorInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Redirect if not logged in
    if (!user || !profile) {
      router.push('/login');
      return;
    }

    // Redirect if not a fan
    if (profile.user_type !== 'FAN') {
      router.push('/');
      return;
    }

    // Fetch creator info
    if (creatorId) {
      fetch(`/api/profiles/${creatorId}`)
        .then(res => res.json())
        .then(data => {
          setCreatorInfo(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Error fetching creator info:', err);
          setLoading(false);
        });
    }
  }, [user, profile, creatorId, router]);

  const handlePayment = () => {
    // TODO: Implement actual payment processing
    // For now, just show an alert
    alert('Payment processing not implemented yet. This would integrate with Stripe or similar payment processor.');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-md mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold">Get Chat Access</h1>
        </div>

        {/* Creator Info */}
        {creatorInfo && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <img 
                src={creatorInfo.profile_picture_url || '/default-avatar.svg'} 
                alt={creatorInfo.display_name}
                className="w-16 h-16 rounded-full object-cover"
              />
              <div>
                <h2 className="text-lg font-semibold">{creatorInfo.display_name}</h2>
                <p className="text-gray-500 text-sm">Creator on simp3</p>
              </div>
            </div>
          </div>
        )}

        {/* Payment Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Chat Access Details</h3>
          
          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Access Duration</span>
              <span className="font-medium">{days} days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Price</span>
              <span className="font-semibold text-lg">${amount}</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total</span>
                <span className="font-bold text-xl">${amount}</span>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CreditCard className="w-4 h-4" />
              <span>Direct messaging access</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Shield className="w-4 h-4" />
              <span>Secure and private</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span>Instant activation</span>
            </div>
          </div>

          {/* Payment Button */}
          <button
            onClick={handlePayment}
            className="w-full bg-indigo-600 text-white font-semibold py-3 px-6 rounded-full hover:bg-indigo-700 transition-colors"
          >
            Complete Payment
          </button>
        </div>

        {/* Terms */}
        <p className="text-xs text-gray-500 text-center">
          By completing this purchase, you agree to our Terms of Service and Privacy Policy. 
          Access will be automatically activated upon successful payment.
        </p>
      </div>
    </div>
  );
}
