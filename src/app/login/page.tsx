import { Suspense } from 'react';
import LoginClient from './LoginClient';

// Mark this page as dynamic to prevent static generation issues
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    }>
      <LoginClient />
    </Suspense>
  );
}

