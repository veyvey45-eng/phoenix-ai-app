/**
 * ConnectionStatus - Indicateur de statut de connexion
 */

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  className?: string;
  showLabel?: boolean;
}

export function ConnectionStatus({ className, showLabel = false }: ConnectionStatusProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsReconnecting(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleReconnect = () => {
    setIsReconnecting(true);
    // Simuler une tentative de reconnexion
    setTimeout(() => {
      setIsReconnecting(false);
      setIsOnline(navigator.onLine);
    }, 2000);
  };

  if (isOnline && !showLabel) {
    return null; // Ne rien afficher si en ligne et pas de label demandé
  }

  return (
    <div 
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all",
        isOnline 
          ? "bg-green-500/10 text-green-500" 
          : "bg-red-500/10 text-red-500",
        className
      )}
    >
      {isReconnecting ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : isOnline ? (
        <Wifi className="w-4 h-4" />
      ) : (
        <WifiOff className="w-4 h-4" />
      )}
      
      {showLabel && (
        <span className="font-medium">
          {isReconnecting 
            ? "Reconnexion..." 
            : isOnline 
              ? "En ligne" 
              : "Hors ligne"
          }
        </span>
      )}

      {!isOnline && !isReconnecting && (
        <button
          onClick={handleReconnect}
          className="ml-2 text-xs underline hover:no-underline"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}

// Composant pour afficher une bannière de déconnexion
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-red-500 text-white py-2 px-4 text-center text-sm animate-slide-up">
      <div className="flex items-center justify-center gap-2">
        <WifiOff className="w-4 h-4" />
        <span>Vous êtes hors ligne. Certaines fonctionnalités peuvent ne pas être disponibles.</span>
      </div>
    </div>
  );
}
