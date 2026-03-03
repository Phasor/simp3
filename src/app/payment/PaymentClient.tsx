'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { ArrowLeft, CreditCard, Shield, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { getProfilePictureUrl } from '@/lib/utils/bunnynet';
import { formatAccessDuration, type TimeUnit } from '@/lib/utils/timeUnits';

interface CreatorInfo {
  id: string;
  display_name: string | null;
  profile_picture_url: string | null;
  min_spend_cents?: number;
  access_days?: number;
  time_unit?: TimeUnit;
}

export default function PaymentClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const creatorId = searchParams.get('creator');
  const amount = searchParams.get('amount');
  const days = searchParams.get('days');

  const [creatorInfo, setCreatorInfo] = useState<CreatorInfo | null>(null);
  const [actualPrice, setActualPrice] = useState<number | null>(null);
  const [actualDays, setActualDays] = useState<number | null>(null);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('days');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Wait for auth to resolve before redirecting
    if (authLoading) return;

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

    // Fetch creator info and chat rules
    if (creatorId) {
      Promise.all([
        fetch(`/api/profiles/${creatorId}`).then(res => res.json()),
        fetch(`/api/chat/rules/${creatorId}`).then(res => res.json())
      ])
        .then(([creatorData, rulesData]) => {
          setCreatorInfo(creatorData);
          
          // Use actual chat rules or defaults
          const price = rulesData.min_spend_cents ? rulesData.min_spend_cents / 100 : 100;
          const accessDays = rulesData.access_days || 30;
          const unit = rulesData.time_unit || 'days';
          
          setActualPrice(price);
          setActualDays(accessDays);
          setTimeUnit(unit);
          setLoading(false);
        })
        .catch(err => {
          console.error('Error fetching creator info:', err);
          setLoading(false);
        });
    }
  }, [user, profile, authLoading, creatorId, router]);

  const handlePayment = async () => {
    if (!creatorId || actualPrice === null || actualDays === null) {
      setError('Missing payment information');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/payment/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creatorId,
          amount: actualPrice,
          days: actualDays
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      if (data.success) {
        setSuccess(true);
        // Redirect to chat with a flag to indicate fresh purchase
        setTimeout(() => {
          router.push(`/chat?creator=${creatorId}&fan=${profile?.id}&newAccess=true`);
        }, 2000);
      } else {
        throw new Error(data.error || 'Payment failed');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setProcessing(false);
    }
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
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="typ-h2 text-gray-900">Get Chat Access</h1>
        </div>

        {/* Creator Info */}
        {creatorInfo && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <img 
                src={getProfilePictureUrl(creatorInfo.profile_picture_url)} 
                alt={creatorInfo.display_name || 'Creator'}
                className="w-16 h-16 rounded-full object-cover"
              />
              <div>
                <h2 className="text-lg font-semibold">{creatorInfo.display_name || 'Creator'}</h2>
                <p className="text-gray-500 typ-body-sm">Creator on simp3</p>
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
              <span className="font-medium">{actualDays ? formatAccessDuration(actualDays, timeUnit) : `${days} days`}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Price</span>
              <span className="font-semibold text-lg">${actualPrice || amount}</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total</span>
                <span className="font-bold text-xl">${actualPrice || amount}</span>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2 typ-body-sm text-gray-600">
              <CreditCard className="w-4 h-4" />
              <span>Direct messaging access</span>
            </div>
            <div className="flex items-center gap-2 typ-body-sm text-gray-600">
              <Shield className="w-4 h-4" />
              <span>Secure and private</span>
            </div>
            <div className="flex items-center gap-2 typ-body-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span>Instant activation</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
              <span className="typ-body-sm text-red-900 font-medium">{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-300 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 flex-shrink-0 text-green-600" />
              <span className="typ-body-sm text-green-900 font-medium">Payment successful! Redirecting to chat...</span>
            </div>
          )}

          {/* Payment Button */}
          <button
            onClick={handlePayment}
            disabled={processing || success}
            className={`w-full font-semibold py-3 px-6 rounded-full transition-colors flex items-center justify-center gap-2 ${
              processing || success
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {processing && <Loader2 className="w-4 h-4 animate-spin" />}
            {processing ? 'Processing Payment...' : success ? 'Payment Complete!' : 'Complete Payment'}
          </button>
        </div>

        {/* Terms */}
        <p className="typ-caption text-gray-500 text-center">
          By completing this purchase, you agree to our Terms of Service and Privacy Policy. 
          Access will be automatically activated upon successful payment.
        </p>
      </div>
    </div>
  );
}

