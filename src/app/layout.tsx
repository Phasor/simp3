import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { FLAGS } from '@/lib/flags';
import { Toaster } from "react-hot-toast";
import ConditionalNavigation from "@/components/ConditionalNavigation";
import ConditionalFooter from "@/components/ConditionalFooter";
import "./globals.css";

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
  title: "simp3",
  description: "Connect with creators through exclusive chat experiences",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialSession = null;
  
  if (FLAGS.SERVER_AUTH_GATE) {
    try {
      // ⬇️ assert envs loudly so failures are obvious
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      console.log('🔍 Environment check:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        urlLength: supabaseUrl?.length,
        keyLength: supabaseKey?.length
      });

      if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
      if (!supabaseKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');

      const supabase = createServerClient(
        supabaseUrl,
        supabaseKey,
        {
          cookies: {
            async get(name: string) {
              return (await cookies()).get(name)?.value;
            },
            async set(name: string, value: string, options?: any) {
              try {
                (await cookies()).set(name, value, options);
              } catch {
                // Called from Server Component - safe to ignore
              }
            },
            async remove(name: string, options?: any) {
              try {
                (await cookies()).set(name, '', { ...options, maxAge: 0 });
              } catch {
                // Called from Server Component - safe to ignore
              }
            },
          },
        }
      );
      
      const { data: { session } } = await supabase.auth.getSession();
      initialSession = session;
    } catch (error) {
      console.warn('Failed to get server session:', error);
      // Continue with null session
    }
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} antialiased min-h-screen flex flex-col`}
      >
        <AuthProvider initialSession={initialSession}>
          <ConditionalNavigation title="simp3" />
          <main className="flex-1">
            {children}
          </main>
          <ConditionalFooter />
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
