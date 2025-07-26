"use client";

import { useAuth } from '@/components/AuthProvider';
import { auth } from '@/firebase';
import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Home, ShieldAlert, Vote, Trophy, LogOut, User, Menu, X } from 'lucide-react';

// Custom hook to detect clicks outside of a component
const useClickOutside = (ref: React.RefObject<HTMLElement | null>, handler: (event: MouseEvent | TouchEvent) => void) => {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      // Do nothing if the click is on the element or its descendants
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
};

export default function Navbar() {
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setIsMenuOpen(false); // Close menu on logout
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  // Use the custom hook to close the menu when clicking outside
  useClickOutside(menuRef, closeMenu);

  const navLinks = [
    { href: '/', label: 'Map Pulse', icon: <Home size={20} /> },
    { href: '/report', label: 'Report Issue', icon: <ShieldAlert size={20} /> },
    { href: '/voting', label: 'Voting', icon: <Vote size={20} /> },
    { href: '/leaderboard', label: 'Leaderboard', icon: <Trophy size={20} /> }
  ];

  // Function to determine if a link is active
  const isActivePath = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-lg shadow-cyan-100/10">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group" onClick={closeMenu}>
                <Image src="/logo_citysense.png" alt="Logo" width={36} height={36} className="transform group-hover:scale-110 transition-transform duration-300" />
                <span className="text-xl font-bold text-gray-800 group-hover:bg-gradient-to-r group-hover:from-cyan-500 group-hover:to-orange-500 group-hover:bg-clip-text group-hover:text-transparent transition-colors duration-300">
                  CitySense
                </span>
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ease-in-out transform hover:-translate-y-0.5 ${
                    isActivePath(link.href)
                      ? 'bg-gradient-to-r from-cyan-50 to-orange-50 font-semibold'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
                  }`}
                >
                  <span className={isActivePath(link.href) ? 'text-cyan-500' : ''}>
                    {link.icon}
                  </span>
                  <span className={isActivePath(link.href) ? 'bg-gradient-to-r from-cyan-500 to-orange-500 bg-clip-text text-transparent' : ''}>
                    {link.label}
                  </span>
                </Link>
              ))}
            </div>

            {/* User Menu & Mobile Menu Button */}
            <div className="flex items-center gap-2 sm:gap-4">
              {user ? (
                <>
                  {/* Desktop User Info & Logout */}
                  <div className="hidden md:flex items-center gap-2">
                    <Link href="/profile" className="flex items-center gap-3 pl-2 pr-4 py-1.5 rounded-full bg-white/60 border border-gray-200/80 shadow-sm hover:bg-white/80 hover:shadow-md transition-all duration-200">
                      {user.photoURL ? (
                        <img
                          referrerPolicy="no-referrer"
                          src={user.photoURL}
                          alt={user.displayName || 'User Avatar'}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 text-gray-500">
                          <User size={18} />
                        </span>
                      )}
                       <span className="text-gray-700 text-sm font-medium">
                        {user.displayName?.split(' ')[0] || 'User'}
                      </span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center justify-center w-10 h-10 text-gray-500 hover:text-red-500 hover:bg-red-100/50 rounded-full transition-colors duration-200"
                      aria-label="Logout"
                    >
                      <LogOut size={20} />
                    </button>
                  </div>

                  {/* Mobile Menu Button */}
                  <button
                    onClick={toggleMenu}
                    className="md:hidden p-2 rounded-full hover:bg-gray-100/50 transition-colors"
                    aria-label="Toggle menu"
                  >
                    {isMenuOpen ? <X className="text-gray-700" /> : <Menu className="text-gray-700" />}
                  </button>
                </>
              ) : (
                 <Link href="/login" className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-orange-500 hover:from-cyan-600 hover:to-orange-600 rounded-full shadow-md hover:shadow-lg transform hover:scale-105 transition-all">
                   Login
                 </Link>
              )}
            </div>
          </div>
        </nav>
      </header>

              
      {/* Mobile Menu Flyout */}
      <div 
        ref={menuRef}
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-gradient-to-br from-cyan-50 via-green-50 to-orange-100 shadow-2xl z-60 transform transition-transform duration-500 ease-in-out md:hidden ${
          isMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {isMenuOpen && (
            <div className="flex flex-col h-full p-4">
                {/* Mobile Menu Header */}
                {user && (
                    <Link href="/profile" onClick={closeMenu} className="flex items-center gap-4 p-4 rounded-2xl bg-white/50 backdrop-blur-sm border border-white/50 mb-6 hover:bg-white/70 transition-all duration-200">
                        {user.photoURL ? (
                          <img
                              src={user.photoURL}
                              alt={user.displayName || 'User Avatar'}
                              className="w-14 h-14 rounded-full object-cover border-2 border-white"
                              referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="flex items-center justify-center w-14 h-14 rounded-full bg-gray-200 text-gray-500 border-2 border-white">
                            <User size={32} />
                          </span>
                        )}
                        <div className="min-w-0">
                            <p className="font-bold text-gray-800 truncate">{user.displayName || 'Anonymous User'}</p>
                            <p className="text-sm text-gray-500 truncate">{user.email}</p>
                        </div>
                    </Link>
                )}

                {/* Navigation Links */}
                <nav className="flex-grow">
                    <div className="space-y-2">
                        {navLinks.map((link) => (
                            <Link
                            key={link.href}
                            href={link.href}
                            onClick={closeMenu}
                            className={`flex items-center gap-4 px-4 py-3 rounded-xl text-base font-semibold transition-all duration-200 ${
                                isActivePath(link.href)
                                ? 'bg-white/80 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                            }`}
                            >
                              <span className={isActivePath(link.href) ? 'text-cyan-500' : ''}>
                                {link.icon}
                              </span>
                              <span className={isActivePath(link.href) ? 'bg-gradient-to-r from-cyan-500 to-orange-500 bg-clip-text text-transparent' : ''}>
                                {link.label}
                              </span>
                            </Link>
                        ))}
                    </div>
                </nav>

                {/* Logout Button */}
                {user && (
                    <div className="mt-6">
                        <button
                            onClick={handleLogout}
                            className="flex items-center justify-center gap-3 w-full px-4 py-3 text-red-500 bg-red-100/70 hover:bg-red-100 rounded-xl transition-colors duration-200 font-bold"
                        >
                            <LogOut size={20} />
                            Sign Out
                        </button>
                    </div>
                )}
            </div>
        )}
      </div>
      
      {/* Overlay for mobile menu */}
      {isMenuOpen && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 md:hidden" onClick={closeMenu}></div>}
    </>
  );
}
