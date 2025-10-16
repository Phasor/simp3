"use client";

import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-white mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-6 md:px-6">
        {/* Footer Content */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6 text-sm">
          {/* Navigation Links */}
          <Link href="/about" className="hover:underline transition-colors">
            About
          </Link>
          <Link href="/privacy" className="hover:underline transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:underline transition-colors">
            Terms
          </Link>
          <Link href="/support" className="hover:underline transition-colors">
            Support
          </Link>
          
          {/* Copyright */}
          <span className="text-xs text-gray-600">
            © {currentYear} CreatorHub. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
