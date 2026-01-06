/**
 * VoiceLiveMode - Mode conversation vocale en temps réel
 * Permet de parler à Phoenix et d'écouter ses réponses
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff, 
  Volume2, 
  VolumeX,
  Loader2,
  Radio
} from 'lucide-react';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { cn } from '@/lib/utils';

interface VoiceLiveModeProps {
  onSendMessage: (message: string) => Promise<string>;
  isProcessing?: boolean;
  className?: string;
}

type LiveModeState = 'idle' | 'listening' | 'processing' | 'speaking';

export function VoiceLiveMode({ 
  onSendMessage, 
  isProcessing = false,
  className 
}: VoiceLiveModeProps) {
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveState, setLiveState] = useState<LiveModeState>('idle');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [currentTranscript, setCurrentTranscript] = useState('');
  
  const processingRef = useRef(false);

  // Speech-to-Text hook
  const {
    isListening,
    isSupported: sttSupported,
    transcript,
    interimTranscript,
    error: sttError,
    startListening,
    stopListening,
    resetTranscript
  } = useSpeechToText({
    lang: 'fr-FR',
    continuous: false,
    interimResults: true,
    onResult: (text, isFinal) => {
      if (isFinal && text.trim() && isLiveMode && !processingRef.current) {
        handleVoiceInput(text.trim());
      }
    }
  });

  // Text-to-Speech hook
  const {
    isSpeaking,
    isSupported: ttsSupported,
    speak,
    stop: stopSpeaking
  } = useTextToSpeech({ lang: 'fr-FR', rate: 1.0 });

  // Gérer l'entrée vocale
  const handleVoiceInput = useCallback(async (text: string) => {
    if (processingRef.current) return;
    
    processingRef.current = true;
    setLiveState('processing');
    setCurrentTranscript(text);
    
    try {
      const response = await onSendMessage(text);
      
      if (autoSpeak && response) {
        setLiveState('speaking');
        speak(response);
      } else {
        setLiveState('idle');
      }
    } catch (error) {
      console.error('Erreur lors du traitement vocal:', error);
      setLiveState('idle');
    } finally {
      processingRef.current = false;
      resetTranscript();
    }
  }, [onSendMessage, autoSpeak, speak, resetTranscript]);

  // Mettre à jour l'état en fonction de l'écoute/parole
  useEffect(() => {
    if (isListening) {
      setLiveState('listening');
    } else if (isSpeaking) {
      setLiveState('speaking');
    } else if (!processingRef.current) {
      setLiveState('idle');
    }
  }, [isListening, isSpeaking]);

  // Quand la parole se termine, recommencer à écouter si en mode live
  useEffect(() => {
    if (isLiveMode && !isSpeaking && !isListening && !processingRef.current && liveState !== 'processing') {
      const timer = setTimeout(() => {
        if (isLiveMode && !processingRef.current) {
          startListening();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLiveMode, isSpeaking, isListening, liveState, startListening]);

  // Démarrer le mode live
  const startLiveMode = useCallback(() => {
    if (!sttSupported || !ttsSupported) {
      alert('Votre navigateur ne supporte pas les fonctionnalités vocales.');
      return;
    }
    
    setIsLiveMode(true);
    startListening();
  }, [sttSupported, ttsSupported, startListening]);

  // Arrêter le mode live
  const stopLiveMode = useCallback(() => {
    setIsLiveMode(false);
    stopListening();
    stopSpeaking();
    resetTranscript();
    setLiveState('idle');
    setCurrentTranscript('');
    processingRef.current = false;
  }, [stopListening, stopSpeaking, resetTranscript]);

  // Toggle le mode live
  const toggleLiveMode = useCallback(() => {
    if (isLiveMode) {
      stopLiveMode();
    } else {
      startLiveMode();
    }
  }, [isLiveMode, startLiveMode, stopLiveMode]);

  // Vérifier le support
  if (!sttSupported || !ttsSupported) {
    return null;
  }

  // Déterminer l'icône et la couleur selon l'état
  const getStateInfo = () => {
    switch (liveState) {
      case 'listening':
        return {
          icon: <Mic className="h-5 w-5 animate-pulse" />,
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          label: 'Écoute...'
        };
      case 'processing':
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin" />,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          label: 'Traitement...'
        };
      case 'speaking':
        return {
          icon: <Volume2 className="h-5 w-5 animate-pulse" />,
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          label: 'Phoenix parle...'
        };
      default:
        return {
          icon: <Radio className="h-5 w-5" />,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
          label: 'Mode Live'
        };
    }
  };

  const stateInfo = getStateInfo();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Bouton principal Live */}
      <Button
        variant={isLiveMode ? 'default' : 'outline'}
        size="sm"
        onClick={toggleLiveMode}
        className={cn(
          'gap-2 transition-all duration-300',
          isLiveMode && 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
        )}
      >
        {isLiveMode ? (
          <>
            <PhoneOff className="h-4 w-4" />
            Arrêter
          </>
        ) : (
          <>
            <Phone className="h-4 w-4" />
            Live
          </>
        )}
      </Button>

      {/* Indicateur d'état quand en mode live */}
      {isLiveMode && (
        <div className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300',
          stateInfo.bgColor
        )}>
          <span className={stateInfo.color}>{stateInfo.icon}</span>
          <span className={cn('text-sm font-medium', stateInfo.color)}>
            {stateInfo.label}
          </span>
        </div>
      )}

      {/* Toggle auto-speak */}
      {isLiveMode && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setAutoSpeak(!autoSpeak)}
          title={autoSpeak ? 'Désactiver la voix' : 'Activer la voix'}
          className={cn(
            'h-8 w-8',
            autoSpeak ? 'text-green-500' : 'text-muted-foreground'
          )}
        >
          {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
      )}

      {/* Afficher le transcript en cours */}
      {isLiveMode && (interimTranscript || currentTranscript) && (
        <div className="flex-1 px-3 py-1 bg-muted/50 rounded-lg text-sm text-muted-foreground italic truncate max-w-xs">
          {interimTranscript || currentTranscript}
        </div>
      )}

      {/* Afficher les erreurs */}
      {sttError && (
        <span className="text-xs text-red-500">{sttError}</span>
      )}
    </div>
  );
}

/**
 * VoiceLiveModeCompact - Version compacte du bouton Live
 */
export function VoiceLiveModeCompact({ 
  onSendMessage,
  className 
}: VoiceLiveModeProps) {
  const [isLiveMode, setIsLiveMode] = useState(false);
  
  const {
    isListening,
    isSupported: sttSupported,
    startListening,
    stopListening,
    resetTranscript
  } = useSpeechToText({
    lang: 'fr-FR',
    continuous: false,
    onResult: async (text, isFinal) => {
      if (isFinal && text.trim()) {
        await onSendMessage(text.trim());
        resetTranscript();
        // Recommencer à écouter
        setTimeout(() => {
          if (isLiveMode) startListening();
        }, 1000);
      }
    }
  });

  const { isSupported: ttsSupported, speak, isSpeaking } = useTextToSpeech();

  const toggleLive = useCallback(() => {
    if (isLiveMode) {
      setIsLiveMode(false);
      stopListening();
    } else {
      setIsLiveMode(true);
      startListening();
    }
  }, [isLiveMode, startListening, stopListening]);

  if (!sttSupported || !ttsSupported) return null;

  return (
    <Button
      variant={isLiveMode ? 'default' : 'ghost'}
      size="icon"
      onClick={toggleLive}
      className={cn(
        'relative',
        isLiveMode && 'bg-green-500 hover:bg-green-600',
        isListening && 'animate-pulse',
        className
      )}
      title={isLiveMode ? 'Arrêter le mode Live' : 'Démarrer le mode Live'}
    >
      {isListening ? (
        <Mic className="h-4 w-4 text-red-500" />
      ) : isSpeaking ? (
        <Volume2 className="h-4 w-4" />
      ) : (
        <Phone className="h-4 w-4" />
      )}
      
      {/* Indicateur de mode actif */}
      {isLiveMode && (
        <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-400 rounded-full animate-ping" />
      )}
    </Button>
  );
}

export default VoiceLiveMode;
