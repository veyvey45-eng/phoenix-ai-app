/**
 * KeyboardShortcutsHelp - Affiche les raccourcis clavier disponibles
 */

import React, { useState, useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcuts';

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  // Navigation
  { keys: ['Ctrl', 'K'], description: 'Ouvrir la recherche', category: 'Navigation' },
  { keys: ['Ctrl', 'B'], description: 'Afficher/Masquer la sidebar', category: 'Navigation' },
  { keys: ['Ctrl', 'Shift', 'T'], description: 'Changer le thème', category: 'Navigation' },
  { keys: ['Esc'], description: 'Fermer le dialogue', category: 'Navigation' },
  
  // Conversation
  { keys: ['Ctrl', 'N'], description: 'Nouvelle conversation', category: 'Conversation' },
  { keys: ['/'], description: 'Focus sur le champ de saisie', category: 'Conversation' },
  { keys: ['Ctrl', 'Enter'], description: 'Envoyer le message', category: 'Conversation' },
  { keys: ['Ctrl', 'Shift', 'C'], description: 'Copier la dernière réponse', category: 'Conversation' },
  
  // Code
  { keys: ['Ctrl', 'Shift', 'E'], description: 'Exécuter le code', category: 'Code' },
  { keys: ['Ctrl', 'S'], description: 'Sauvegarder le code', category: 'Code' },
  { keys: ['Ctrl', 'Z'], description: 'Annuler', category: 'Code' },
  { keys: ['Ctrl', 'Shift', 'Z'], description: 'Rétablir', category: 'Code' },
];

function KeyboardKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-2 py-1 text-xs font-semibold bg-muted border border-border rounded shadow-sm">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  // Raccourci pour ouvrir l'aide (Ctrl + ?)
  useKeyboardShortcut({
    key: '?',
    ctrl: true,
    handler: () => setOpen(true),
  });

  // Grouper les raccourcis par catégorie
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9"
          title="Raccourcis clavier (Ctrl + ?)"
        >
          <Keyboard className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Raccourcis Clavier
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {category}
              </h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          <KeyboardKey>{key}</KeyboardKey>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground mx-1">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Appuyez sur <KeyboardKey>Ctrl</KeyboardKey> + <KeyboardKey>?</KeyboardKey> pour afficher cette aide à tout moment
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
