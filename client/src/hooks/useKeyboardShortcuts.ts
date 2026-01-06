/**
 * useKeyboardShortcuts - Hook pour gérer les raccourcis clavier
 */

import { useEffect, useCallback } from 'react';

type KeyHandler = (event: KeyboardEvent) => void;

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: KeyHandler;
  description?: string;
}

export function useKeyboardShortcut(config: ShortcutConfig) {
  const { key, ctrl, shift, alt, meta, handler } = config;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const matchesKey = event.key.toLowerCase() === key.toLowerCase();
    const matchesCtrl = ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
    const matchesShift = shift ? event.shiftKey : !event.shiftKey;
    const matchesAlt = alt ? event.altKey : !event.altKey;
    const matchesMeta = meta ? event.metaKey : true;

    if (matchesKey && matchesCtrl && matchesShift && matchesAlt) {
      event.preventDefault();
      handler(event);
    }
  }, [key, ctrl, shift, alt, meta, handler]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const { key, ctrl, shift, alt, handler } = shortcut;
        
        const matchesKey = event.key.toLowerCase() === key.toLowerCase();
        const matchesCtrl = ctrl ? (event.ctrlKey || event.metaKey) : (!event.ctrlKey && !event.metaKey);
        const matchesShift = shift ? event.shiftKey : !event.shiftKey;
        const matchesAlt = alt ? event.altKey : !event.altKey;

        if (matchesKey && matchesCtrl && matchesShift && matchesAlt) {
          event.preventDefault();
          handler(event);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

// Raccourcis prédéfinis pour Phoenix
export const PHOENIX_SHORTCUTS = {
  NEW_CHAT: { key: 'n', ctrl: true, description: 'Nouvelle conversation' },
  SEARCH: { key: 'k', ctrl: true, description: 'Rechercher' },
  TOGGLE_SIDEBAR: { key: 'b', ctrl: true, description: 'Afficher/Masquer la sidebar' },
  TOGGLE_THEME: { key: 't', ctrl: true, shift: true, description: 'Changer le thème' },
  FOCUS_INPUT: { key: '/', description: 'Focus sur le champ de saisie' },
  ESCAPE: { key: 'Escape', description: 'Fermer le dialogue' },
  SUBMIT: { key: 'Enter', ctrl: true, description: 'Envoyer le message' },
};

export function formatShortcut(shortcut: Partial<ShortcutConfig>): string {
  const parts: string[] = [];
  
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.meta) parts.push('⌘');
  if (shortcut.key) parts.push(shortcut.key.toUpperCase());
  
  return parts.join(' + ');
}
