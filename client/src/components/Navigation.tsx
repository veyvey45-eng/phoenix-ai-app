/**
 * Navigation Component - Barre de navigation principale
 */

import React from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Brain, MessageSquare, LayoutDashboard, Code2, LogOut, Menu, X, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { getLoginUrl } from '@/const';

export function Navigation() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setLocation('/');
  };

  const navItems = user ? [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Chat', icon: MessageSquare, href: '/chat' },
    { label: 'Code Executor', icon: Code2, href: '/code-executor' },
    { label: 'Web Generator', icon: Sparkles, href: '/web-generator' },
    { label: 'Showcase', icon: Sparkles, href: '/showcase' },
  ] : [];

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation('/')}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg hidden sm:inline">Phoenix</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <Button
                key={item.href}
                variant="ghost"
                size="sm"
                onClick={() => setLocation(item.href)}
                className="gap-2"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Button>
            ))}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Déconnexion</span>
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => window.location.href = getLoginUrl()}
              >
                Connexion
              </Button>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && user && (
          <div className="md:hidden pb-4 space-y-2">
            {navItems.map(item => (
              <Button
                key={item.href}
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLocation(item.href);
                  setIsOpen(false);
                }}
                className="w-full justify-start gap-2"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
