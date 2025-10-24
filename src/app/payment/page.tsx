import { Suspense } from 'react';
import PaymentClient from './PaymentClient';

// Mark this page as dynamic to prevent static generation issues
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    }>
      <PaymentClient />
    </Suspense>
  );
}
