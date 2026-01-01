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

// Safe check for speechSynthesis availability
function getSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  if (!('speechSynthesis' in window)) return null;
  try {
    // Test if speechSynthesis is actually accessible
    const synth = window.speechSynthesis;
    if (!synth) return null;
    // Test if methods exist
    if (typeof synth.getVoices !== 'function') return null;
    return synth;
  } catch (e) {
    console.warn('SpeechSynthesis not available:', e);
    return null;
  }
}

function loadSettings(): SpeechSettings {
  try {
    if (typeof window === 'undefined') {
      return { voiceName: '', rate: 1, pitch: 1, volume: 1 };
    }
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
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  } catch (e) {
    console.warn('Failed to save TTS settings:', e);
  }
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSupported, setIsSupported] = useState(false); // Default to false, set true after check
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [settings, setSettings] = useState<SpeechSettings>(() => loadSettings());
  
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Check browser support and load voices
  useEffect(() => {
    const synth = getSpeechSynthesis();
    synthRef.current = synth;
    
    if (!synth) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const loadVoices = () => {
      try {
        const availableVoices = synth.getVoices();
        
        if (!availableVoices || availableVoices.length === 0) {
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
        setSettings(prev => {
          if (prev.voiceName) return prev;
          
          // Prefer a French voice
          const defaultFrench = frenchVoices.find(v => v.default) || frenchVoices[0];
          if (defaultFrench) {
            const newSettings = { ...prev, voiceName: defaultFrench.name };
            saveSettings(newSettings);
            return newSettings;
          } else if (availableVoices.length > 0) {
            const newSettings = { ...prev, voiceName: availableVoices[0].name };
            saveSettings(newSettings);
            return newSettings;
          }
          return prev;
        });
      } catch (e) {
        console.warn('Error loading voices:', e);
      }
    };

    // Load voices immediately
    loadVoices();
    
    // Also listen for voices changed event (needed for Chrome)
    try {
      synth.onvoiceschanged = loadVoices;
    } catch (e) {
      console.warn('Could not set onvoiceschanged:', e);
    }

    return () => {
      try {
        if (synth && synth.onvoiceschanged) {
          synth.onvoiceschanged = null;
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        const synth = synthRef.current;
        if (synth && typeof synth.cancel === 'function') {
          synth.cancel();
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, []);

  const speak = useCallback((text: string) => {
    const synth = synthRef.current;
    if (!synth || !isSupported || !text) return;

    try {
      // Cancel any ongoing speech
      if (typeof synth.cancel === 'function') {
        synth.cancel();
      }

      // Clean text for speech (remove markdown, etc.)
      const cleanText = text
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1')     // Italic
        .replace(/`(.*?)`/g, '$1')       // Code
        .replace(/#{1,6}\s/g, '')        // Headers
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
        .replace(/\n+/g, '. ')           // Newlines to pauses
        .trim();

      if (!cleanText) return;

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
        console.warn('Speech synthesis error:', event.error);
        setIsPlaying(false);
        setIsPaused(false);
      };

      utterance.onpause = () => {
        setIsPaused(true);
      };

      utterance.onresume = () => {
        setIsPaused(false);
      };

      synth.speak(utterance);
    } catch (e) {
      console.warn('Error speaking:', e);
      setIsPlaying(false);
      setIsPaused(false);
    }
  }, [isSupported, voices, settings]);

  const pause = useCallback(() => {
    try {
      const synth = synthRef.current;
      if (synth && isPlaying && !isPaused && typeof synth.pause === 'function') {
        synth.pause();
      }
    } catch (e) {
      console.warn('Error pausing:', e);
    }
  }, [isPlaying, isPaused]);

  const resume = useCallback(() => {
    try {
      const synth = synthRef.current;
      if (synth && isPlaying && isPaused && typeof synth.resume === 'function') {
        synth.resume();
      }
    } catch (e) {
      console.warn('Error resuming:', e);
    }
  }, [isPlaying, isPaused]);

  const stop = useCallback(() => {
    try {
      const synth = synthRef.current;
      if (synth && typeof synth.cancel === 'function') {
        synth.cancel();
      }
      setIsPlaying(false);
      setIsPaused(false);
    } catch (e) {
      console.warn('Error stopping:', e);
      setIsPlaying(false);
      setIsPaused(false);
    }
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
