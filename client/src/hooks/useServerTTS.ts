import { useState, useRef, useCallback, useEffect } from 'react';
import { trpc } from '@/lib/trpc';

export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

interface ServerTTSSettings {
  voice: TTSVoice;
  speed: number;
  volume: number;
}

interface UseServerTTSReturn {
  // State
  isAvailable: boolean;
  isLoading: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  settings: ServerTTSSettings;
  error: string | null;
  
  // Actions
  speak: (text: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  
  // Settings
  setVoice: (voice: TTSVoice) => void;
  setSpeed: (speed: number) => void;
  setVolume: (volume: number) => void;
}

const STORAGE_KEY = 'phoenix-server-tts-settings';

const VOICE_LABELS: Record<TTSVoice, string> = {
  alloy: "Alloy (Neutre)",
  echo: "Echo (Masculin)",
  fable: "Fable (Narratif)",
  onyx: "Onyx (Grave)",
  nova: "Nova (Féminin)",
  shimmer: "Shimmer (Doux)"
};

export const AVAILABLE_VOICES: Array<{ value: TTSVoice; label: string }> = [
  { value: "nova", label: VOICE_LABELS.nova },
  { value: "alloy", label: VOICE_LABELS.alloy },
  { value: "echo", label: VOICE_LABELS.echo },
  { value: "fable", label: VOICE_LABELS.fable },
  { value: "onyx", label: VOICE_LABELS.onyx },
  { value: "shimmer", label: VOICE_LABELS.shimmer }
];

function loadSettings(): ServerTTSSettings {
  try {
    if (typeof window === 'undefined') {
      return { voice: 'nova', speed: 1, volume: 1 };
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load server TTS settings:', e);
  }
  return {
    voice: 'nova',
    speed: 1,
    volume: 1
  };
}

function saveSettings(settings: ServerTTSSettings) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  } catch (e) {
    console.warn('Failed to save server TTS settings:', e);
  }
}

export function useServerTTS(): UseServerTTSReturn {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ServerTTSSettings>(() => loadSettings());
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Check TTS availability
  const availabilityQuery = trpc.tts.checkAvailability.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false
  });

  // TTS mutation
  const ttsMutation = trpc.tts.synthesize.useMutation();

  useEffect(() => {
    if (availabilityQuery.data) {
      setIsAvailable(availabilityQuery.data.available);
    }
  }, [availabilityQuery.data]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!text || isLoading) return;

    setError(null);
    setIsLoading(true);

    try {
      // Clean text for speech (remove markdown, etc.)
      const cleanText = text
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1')     // Italic
        .replace(/`(.*?)`/g, '$1')       // Code
        .replace(/#{1,6}\s/g, '')        // Headers
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
        .replace(/\n+/g, '. ')           // Newlines to pauses
        .trim();

      if (!cleanText) {
        setIsLoading(false);
        return;
      }

      // Truncate if too long
      const truncatedText = cleanText.length > 4096 
        ? cleanText.substring(0, 4093) + '...'
        : cleanText;

      // Call server TTS
      const result = await ttsMutation.mutateAsync({
        text: truncatedText,
        voice: settings.voice,
        speed: settings.speed
      });

      // Create audio from base64
      const audioBlob = base64ToBlob(result.audioBase64, result.mimeType);
      const audioUrl = URL.createObjectURL(audioBlob);

      // Stop any existing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }

      // Create new audio element
      const audio = new Audio(audioUrl);
      audio.volume = settings.volume;
      audioRef.current = audio;

      // Event handlers
      audio.onplay = () => {
        setIsPlaying(true);
        setIsPaused(false);
      };

      audio.onpause = () => {
        if (!audio.ended) {
          setIsPaused(true);
        }
      };

      audio.onended = () => {
        setIsPlaying(false);
        setIsPaused(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setError('Erreur de lecture audio');
        setIsPlaying(false);
        setIsPaused(false);
        URL.revokeObjectURL(audioUrl);
      };

      // Play audio
      await audio.play();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Erreur de synthèse vocale';
      setError(errorMessage);
      console.error('Server TTS error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, settings, ttsMutation]);

  const pause = useCallback(() => {
    if (audioRef.current && isPlaying && !isPaused) {
      audioRef.current.pause();
    }
  }, [isPlaying, isPaused]);

  const resume = useCallback(() => {
    if (audioRef.current && isPlaying && isPaused) {
      audioRef.current.play();
    }
  }, [isPlaying, isPaused]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const setVoice = useCallback((voice: TTSVoice) => {
    setSettings(prev => {
      const newSettings = { ...prev, voice };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  const setSpeed = useCallback((speed: number) => {
    setSettings(prev => {
      const newSettings = { ...prev, speed };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  const setVolume = useCallback((volume: number) => {
    setSettings(prev => {
      const newSettings = { ...prev, volume };
      saveSettings(newSettings);
      return newSettings;
    });
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, []);

  return {
    isAvailable,
    isLoading,
    isPlaying,
    isPaused,
    settings,
    error,
    speak,
    pause,
    resume,
    stop,
    setVoice,
    setSpeed,
    setVolume
  };
}

// Helper function to convert base64 to Blob
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export default useServerTTS;
