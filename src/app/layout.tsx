import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Cormorant_Garamond } from "next/font/google";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import NavSwitcher from "@/components/NavSwitcher";
import PrivyNoSSR from "@/components/PrivyNoSSR";
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

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
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
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${cormorant.variable} antialiased h-screen flex flex-col`}
      >
        <PrivyNoSSR>
          <AuthProvider initialSession={initialSession}>
            <NavSwitcher />
            <main className="flex-1 overflow-y-auto">
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
        </PrivyNoSSR>
      </body>
    </html>
  );
}
