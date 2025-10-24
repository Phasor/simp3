import { Suspense } from 'react';
import SignupClient from './SignupClient';

// Mark this page as dynamic to prevent static generation issues
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    }>
      <SignupClient />
    </Suspense>
  );
}

