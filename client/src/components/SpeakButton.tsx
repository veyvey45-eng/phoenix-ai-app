/**
 * SpeakButton - Bouton pour lire un message à voix haute
 * Utilise l'API Web Speech Synthesis
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX, Loader2, Pause, Play } from 'lucide-react';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { cn } from '@/lib/utils';

interface SpeakButtonProps {
  text: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg' | 'icon';
  variant?: 'default' | 'ghost' | 'outline' | 'secondary';
  showLabel?: boolean;
}

export function SpeakButton({ 
  text, 
  className,
  size = 'icon',
  variant = 'ghost',
  showLabel = false
}: SpeakButtonProps) {
  const { 
    isSpeaking, 
    isPaused, 
    isSupported, 
    speak, 
    pause, 
    resume, 
    stop 
  } = useTextToSpeech({ lang: 'fr-FR', rate: 1.0 });

  const [isLoading, setIsLoading] = useState(false);

  // Gérer le clic sur le bouton
  const handleClick = () => {
    if (!isSupported) {
      alert('La synthèse vocale n\'est pas supportée par votre navigateur.');
      return;
    }

    if (isSpeaking && !isPaused) {
      // En cours de lecture -> Pause
      pause();
    } else if (isPaused) {
      // En pause -> Reprendre
      resume();
    } else {
      // Pas en cours -> Démarrer
      setIsLoading(true);
      speak(text);
      // Petit délai pour l'animation de chargement
      setTimeout(() => setIsLoading(false), 300);
    }
  };

  // Arrêter la lecture quand le composant est démonté
  useEffect(() => {
    return () => {
      if (isSpeaking) {
        stop();
      }
    };
  }, [isSpeaking, stop]);

  // Déterminer l'icône à afficher
  const getIcon = () => {
    if (isLoading) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (isSpeaking && !isPaused) {
      return <Pause className="h-4 w-4" />;
    }
    if (isPaused) {
      return <Play className="h-4 w-4" />;
    }
    return <Volume2 className="h-4 w-4" />;
  };

  // Déterminer le label
  const getLabel = () => {
    if (isSpeaking && !isPaused) return 'Pause';
    if (isPaused) return 'Reprendre';
    return 'Écouter';
  };

  if (!isSupported) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn(
        'transition-all duration-200',
        isSpeaking && 'text-green-500 hover:text-green-600',
        isPaused && 'text-yellow-500 hover:text-yellow-600',
        className
      )}
      title={getLabel()}
    >
      {getIcon()}
      {showLabel && <span className="ml-2">{getLabel()}</span>}
    </Button>
  );
}

/**
 * StopSpeakButton - Bouton pour arrêter la lecture
 */
export function StopSpeakButton({ className }: { className?: string }) {
  const { isSpeaking, isPaused, stop, isSupported } = useTextToSpeech();

  if (!isSupported || (!isSpeaking && !isPaused)) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={stop}
      className={cn('text-red-500 hover:text-red-600', className)}
      title="Arrêter"
    >
      <VolumeX className="h-4 w-4" />
    </Button>
  );
}

export default SpeakButton;
