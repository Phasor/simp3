'use client';

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/contexts/AuthContext";

interface ConditionalNavigationProps {
  title: string;
  titleLink?: string;
}

export default function ConditionalNavigation({ title }: ConditionalNavigationProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading: authLoading, signOut } = useAuth();

  const isOnChatPage = pathname === '/chat';

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setIsMobileMenuOpen(false); // Close mobile menu on logout
    
    try {
      // Set flag to prevent other components from interfering
      localStorage.setItem('isSigningOut', 'true');
      
      // Use AuthContext's signOut function - this handles both client and server cleanup
      await signOut();
      
      // Clear any localStorage items
      localStorage.removeItem('selectedUserType');
      localStorage.removeItem('isSigningOut');
      
      // Redirect to login page using window.location for a full page refresh
      window.location.href = '/login';
      
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.removeItem('isSigningOut');
      alert('Error logging out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleLogoClick = () => {
    router.push('/');
  };

  // On chat page: show minimal navigation for mobile
  if (isOnChatPage) {
    return (
      <header className="md:hidden sticky top-0 z-30 border-b bg-white">
        <div className="px-4 py-3 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleLogoClick}
          >
            <div className="w-6 h-6 rounded-lg bg-black"></div>
            <span className="font-semibold text-sm">{title}</span>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="p-2 rounded-lg hover:bg-gray-100"
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X size={16} strokeWidth={2} />
            ) : (
              <Menu size={16} strokeWidth={2} />
            )}
          </button>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-white border-b shadow-lg z-50">
            <nav className="px-6 py-4 space-y-4">
              {user && (
                <>
                  <Link 
                    href="/" 
                    className="block text-sm hover:text-primary transition-colors"
                    onClick={closeMobileMenu}
                  >
                    Dashboard
                  </Link>
                  <Link 
                    href="/chat"
                    prefetch
                    className="block text-sm hover:text-primary transition-colors"
                    onClick={closeMobileMenu}
                  >
                    Chat
                  </Link>
                  <Link 
                    href={profile?.user_type === 'CREATOR' && profile.id ? `/creator/${profile.id}` : '/profile'} 
                    prefetch={false}
                    className="block text-sm hover:text-primary transition-colors"
                    onClick={closeMobileMenu}
                  >
                    Profile
                  </Link>
                  <button 
                    className="block w-full text-left text-sm bg-gray-100 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                    onClick={() => {
                      handleLogout();
                      closeMobileMenu();
                    }}
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? 'Logging out...' : 'Logout'}
                  </button>
                </>
              )}
              {!authLoading && !user && (
                <Link 
                  href="/signup" 
                  className="block text-sm hover:text-primary transition-colors"
                  onClick={closeMobileMenu}
                >
                  Sign Up Free
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>
    );
  }

  // On all other pages: show full navbar
  return (
    <header className="border-b bg-white relative">
      <div className="max-w-6xl mx-auto px-4 py-3 md:px-6 md:py-4 flex items-center justify-between">
        <div 
          className="flex items-center gap-2 md:gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleLogoClick}
        >
          <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-black"></div>
          <span className="font-semibold text-sm md:text-base">{title}</span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {user && (
            <>
              <Link href="/" className="text-sm bg-gray-100 px-3 py-1 rounded-lg hover:bg-gray-200">
                Dashboard
              </Link>
              <Link href="/chat" prefetch className="text-sm bg-gray-100 px-3 py-1 rounded-lg hover:bg-gray-200">
                Chat
              </Link>
              <Link href={profile?.user_type === 'CREATOR' && profile.id ? `/creator/${profile.id}` : '/profile'} prefetch={false} className="text-sm bg-gray-100 px-3 py-1 rounded-lg hover:bg-gray-200">
                Profile
              </Link>
              <button 
                className="text-sm bg-gray-100 px-3 py-1 rounded-lg hover:bg-gray-200"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                Logout
              </button>
            </>
          )}
          {!authLoading && !user && (
            <Link href="/signup" className="hover:underline">Sign Up Free</Link>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-gray-100"
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <X size={16} strokeWidth={2} />
          ) : (
            <Menu size={16} strokeWidth={2} />
          )}
        </button>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b shadow-lg z-50">
          <nav className="px-6 py-4 space-y-4">
            {user && (
              <>
                <Link 
                  href="/" 
                  className="block text-sm hover:text-primary transition-colors"
                  onClick={closeMobileMenu}
                >
                  Dashboard
                </Link>
                <Link 
                  href="/chat"
                  prefetch
                  className="block text-sm hover:text-primary transition-colors"
                  onClick={closeMobileMenu}
                >
                  Chat
                </Link>
                <Link 
                  href={profile?.user_type === 'CREATOR' && profile.id ? `/creator/${profile.id}` : '/profile'} 
                  prefetch={false}
                  className="block text-sm hover:text-primary transition-colors"
                  onClick={closeMobileMenu}
                >
                  Profile
                </Link>
                <button 
                  className="block w-full text-left text-sm bg-gray-100 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                  onClick={() => {
                    handleLogout();
                    closeMobileMenu();
                  }}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </button>
              </>
            )}
            {!authLoading && !user && (
              <Link 
                href="/signup" 
                className="block text-sm hover:text-primary transition-colors"
                onClick={closeMobileMenu}
              >
                Sign Up Free
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
