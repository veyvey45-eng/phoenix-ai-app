import { useState, useEffect, useRef, useCallback } from 'react';

interface VoiceOption {
  voice: SpeechSynthesisVoice;
  label: string;
  lang: string;
  isCloud: boolean;
}

interface SpeechSettings {
  voiceName: string;
  rate: number;
  pitch: number;
  volume: number;
}

interface UseSpeechSynthesisReturn {
  // State
  isSupported: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  voices: VoiceOption[];
  currentVoice: string;
  settings: SpeechSettings;
  
  // Actions
  speak: (text: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  togglePlayPause: (text: string) => void;
  
  // Settings
  setVoice: (voiceName: string) => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVolume: (volume: number) => void;
}

const STORAGE_KEY = 'phoenix-tts-settings';

function loadSettings(): SpeechSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load TTS settings:', e);
  }
  return {
    voiceName: '',
    rate: 1,
    pitch: 1,
    volume: 1
  };
}

function saveSettings(settings: SpeechSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save TTS settings:', e);
  }
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSupported, setIsSupported] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [settings, setSettings] = useState<SpeechSettings>(loadSettings);
  
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentTextRef = useRef<string>('');

  // Check browser support and load voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsSupported(false);
      return;
    }

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      
      if (availableVoices.length === 0) {
        // Voices not loaded yet, will be called again by onvoiceschanged
        return;
      }
      
      // Prioritize French voices, then other languages
      const frenchVoices = availableVoices.filter(v => v.lang.startsWith('fr'));
      const englishVoices = availableVoices.filter(v => v.lang.startsWith('en'));
      const otherVoices = availableVoices.filter(v => 
        !v.lang.startsWith('fr') && !v.lang.startsWith('en')
      );
      
      const voiceOptions: VoiceOption[] = [
        ...frenchVoices.map(v => ({
          voice: v,
          label: `🇫🇷 ${v.name}`,
          lang: v.lang,
          isCloud: !v.localService
        })),
        ...englishVoices.map(v => ({
          voice: v,
          label: `🇬🇧 ${v.name}`,
          lang: v.lang,
          isCloud: !v.localService
        })),
        ...otherVoices.slice(0, 5).map(v => ({
          voice: v,
          label: `${v.name} (${v.lang})`,
          lang: v.lang,
          isCloud: !v.localService
        }))
      ];

      setVoices(voiceOptions);
      
      // Set default voice if not already set
      if (!settings.voiceName) {
        // Prefer a French voice
        const defaultFrench = frenchVoices.find(v => v.default) || frenchVoices[0];
        if (defaultFrench) {
          setSettings(prev => {
            const newSettings = { ...prev, voiceName: defaultFrench.name };
            saveSettings(newSettings);
            return newSettings;
          });
        } else if (availableVoices.length > 0) {
          setSettings(prev => {
            const newSettings = { ...prev, voiceName: availableVoices[0].name };
            saveSettings(newSettings);
            return newSettings;
          });
        }
      }
    };

    // Load voices immediately
    loadVoices();
    
    // Also listen for voices changed event (needed for Chrome)
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (!isSupported || !text) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    currentTextRef.current = text;

    // Clean text for speech (remove markdown, etc.)
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1')     // Italic
      .replace(/`(.*?)`/g, '$1')       // Code
      .replace(/#{1,6}\s/g, '')        // Headers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
      .replace(/\n+/g, '. ')           // Newlines to pauses
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utteranceRef.current = utterance;

    // Set voice
    const voice = voices.find(v => v.voice.name === settings.voiceName)?.voice;
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    // Set parameters
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;

    // Event handlers
    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onpause = () => {
      setIsPaused(true);
    };

    utterance.onresume = () => {
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [isSupported, voices, settings]);

  const pause = useCallback(() => {
    if (isPlaying && !isPaused) {
      window.speechSynthesis.pause();
    }
  }, [isPlaying, isPaused]);

  const resume = useCallback(() => {
    if (isPlaying && isPaused) {
      window.speechSynthesis.resume();
    }
  }, [isPlaying, isPaused]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const togglePlayPause = useCallback((text: string) => {
    if (!isPlaying) {
      speak(text);
    } else if (isPaused) {
      resume();
    } else {
      pause();
    }
  }, [isPlaying, isPaused, speak, resume, pause]);

  const setVoice = useCallback((voiceName: string) => {
    setSettings(prev => {
      const newSettings = { ...prev, voiceName };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  const setRate = useCallback((rate: number) => {
    setSettings(prev => {
      const newSettings = { ...prev, rate };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  const setPitch = useCallback((pitch: number) => {
    setSettings(prev => {
      const newSettings = { ...prev, pitch };
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
  }, []);

  return {
    isSupported,
    isPlaying,
    isPaused,
    voices,
    currentVoice: settings.voiceName,
    settings,
    speak,
    pause,
    resume,
    stop,
    togglePlayPause,
    setVoice,
    setRate,
    setPitch,
    setVolume
  };
}

export default useSpeechSynthesis;
