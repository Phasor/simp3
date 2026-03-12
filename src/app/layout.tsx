import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { FLAGS } from '@/lib/flags';
import { getServerSupabase } from '@/lib/supabase/server';
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const runtime = 'nodejs';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tribute",
  description: "A devotion platform for doms and subs",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialSession = null;
  
  // Always try to get session from server for better hydration
  try {
    const supabase = await getServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    initialSession = session;
    console.log('[Layout] SSR session:', { 
      hasSession: !!session, 
      userId: session?.user?.id,
      serverAuthGate: FLAGS.SERVER_AUTH_GATE 
    });
  } catch (error) {
    console.warn('[Layout] Failed to get server session:', error);
    // Continue with null session
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} antialiased min-h-screen flex flex-col`}
      >
        <AuthProvider initialSession={initialSession}>
          {/* Nav will be added in Phase 3 */}
          <main className="flex-1">
            {children}
          </main>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#fff',
                color: '#363636',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                border: '1px solid #e5e7eb',
                borderRadius: '0.75rem',
                padding: '16px',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
