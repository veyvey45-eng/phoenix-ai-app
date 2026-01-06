/**
 * CommandPalette - Recherche globale et navigation rapide (Ctrl+K)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  MessageSquare, 
  Code2, 
  Bitcoin, 
  Shield, 
  Sparkles,
  Clock,
  ArrowRight,
  Command
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useLocation } from 'wouter';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcuts';
import { trpc } from '@/lib/trpc';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  category: 'navigation' | 'conversation' | 'action';
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, setLocation] = useLocation();

  // Récupérer les conversations récentes
  const { data: conversations } = trpc.conversations.list.useQuery(undefined, {
    enabled: open,
  });

  // Raccourci Ctrl+K pour ouvrir
  useKeyboardShortcut({
    key: 'k',
    ctrl: true,
    handler: () => setOpen(true),
  });

  // Commandes de navigation
  const navigationCommands: CommandItem[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      description: 'Aller au tableau de bord',
      icon: MessageSquare,
      action: () => { setLocation('/dashboard'); setOpen(false); },
      category: 'navigation',
    },
    {
      id: 'crypto',
      title: 'Crypto Expert',
      description: 'Analyse crypto en temps réel',
      icon: Bitcoin,
      action: () => { setLocation('/crypto'); setOpen(false); },
      category: 'navigation',
    },
    {
      id: 'code',
      title: 'Code Executor',
      description: 'Exécuter du code Python/JavaScript',
      icon: Code2,
      action: () => { setLocation('/code-executor'); setOpen(false); },
      category: 'navigation',
    },
    {
      id: 'web-generator',
      title: 'Web Generator',
      description: 'Générer des pages web',
      icon: Sparkles,
      action: () => { setLocation('/web-generator'); setOpen(false); },
      category: 'navigation',
    },
    {
      id: 'admin',
      title: 'Administration',
      description: 'Paramètres et configuration',
      icon: Shield,
      action: () => { setLocation('/admin'); setOpen(false); },
      category: 'navigation',
    },
  ];

  // Conversations récentes comme commandes
  const conversationCommands: CommandItem[] = (conversations || []).slice(0, 5).map((conv: any) => ({
    id: `conv-${conv.id}`,
    title: conv.title || `Conversation #${conv.id}`,
    description: new Date(conv.updatedAt).toLocaleDateString('fr-FR'),
    icon: Clock,
    action: () => { 
      setLocation(`/dashboard?conv=${conv.id}`); 
      setOpen(false); 
    },
    category: 'conversation' as const,
  }));

  // Toutes les commandes
  const allCommands = [...navigationCommands, ...conversationCommands];

  // Filtrer par recherche
  const filteredCommands = search
    ? allCommands.filter(cmd => 
        cmd.title.toLowerCase().includes(search.toLowerCase()) ||
        cmd.description?.toLowerCase().includes(search.toLowerCase())
      )
    : allCommands;

  // Navigation au clavier
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
        case 'Escape':
          setOpen(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedIndex, filteredCommands]);

  // Reset selection on search change
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center border-b border-border px-3">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Rechercher une page, conversation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Aucun résultat trouvé
            </div>
          ) : (
            <>
              {/* Navigation */}
              {filteredCommands.some(c => c.category === 'navigation') && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                    Navigation
                  </div>
                  {filteredCommands
                    .filter(c => c.category === 'navigation')
                    .map((cmd, index) => {
                      const globalIndex = filteredCommands.indexOf(cmd);
                      return (
                        <button
                          key={cmd.id}
                          onClick={cmd.action}
                          className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors ${
                            globalIndex === selectedIndex
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-muted'
                          }`}
                        >
                          <cmd.icon className="w-4 h-4 shrink-0" />
                          <div className="flex-1 text-left">
                            <div className="font-medium">{cmd.title}</div>
                            {cmd.description && (
                              <div className="text-xs text-muted-foreground">{cmd.description}</div>
                            )}
                          </div>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        </button>
                      );
                    })}
                </div>
              )}

              {/* Conversations récentes */}
              {filteredCommands.some(c => c.category === 'conversation') && (
                <div>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                    Conversations récentes
                  </div>
                  {filteredCommands
                    .filter(c => c.category === 'conversation')
                    .map((cmd) => {
                      const globalIndex = filteredCommands.indexOf(cmd);
                      return (
                        <button
                          key={cmd.id}
                          onClick={cmd.action}
                          className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors ${
                            globalIndex === selectedIndex
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-muted'
                          }`}
                        >
                          <cmd.icon className="w-4 h-4 shrink-0" />
                          <div className="flex-1 text-left">
                            <div className="font-medium">{cmd.title}</div>
                            {cmd.description && (
                              <div className="text-xs text-muted-foreground">{cmd.description}</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd>
            <span>naviguer</span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↵</kbd>
            <span>sélectionner</span>
          </div>
          <div className="flex items-center gap-1">
            <Command className="w-3 h-3" />
            <span>K pour ouvrir</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
