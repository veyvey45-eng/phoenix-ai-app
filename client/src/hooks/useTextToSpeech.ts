/**
 * Hook useTextToSpeech - Synthèse vocale pour lire les messages de Phoenix
 * Utilise l'API Web Speech Synthesis native du navigateur
 */

import { useState, useCallback, useEffect, useRef } from 'react';

interface TextToSpeechOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceName?: string;
}

interface TextToSpeechState {
  isSpeaking: boolean;
  isPaused: boolean;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
  currentVoice: SpeechSynthesisVoice | null;
}

export function useTextToSpeech(options: TextToSpeechOptions = {}) {
  const {
    lang = 'fr-FR',
    rate = 1.0,
    pitch = 1.0,
    volume = 1.0,
    voiceName
  } = options;

  const [state, setState] = useState<TextToSpeechState>({
    isSpeaking: false,
    isPaused: false,
    isSupported: typeof window !== 'undefined' && 'speechSynthesis' in window,
    voices: [],
    currentVoice: null
  });

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Charger les voix disponibles
  useEffect(() => {
    if (!state.isSupported) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      
      // Trouver une voix française de préférence
      let selectedVoice = availableVoices.find(v => 
        voiceName ? v.name === voiceName : v.lang.startsWith('fr')
      );
      
      // Fallback sur la première voix disponible
      if (!selectedVoice && availableVoices.length > 0) {
        selectedVoice = availableVoices[0];
      }

      setState(prev => ({
        ...prev,
        voices: availableVoices,
        currentVoice: selectedVoice || null
      }));
    };

    // Les voix peuvent être chargées de manière asynchrone
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [state.isSupported, voiceName]);

  // Nettoyer le texte pour la lecture (enlever le markdown, etc.)
  const cleanTextForSpeech = useCallback((text: string): string => {
    return text
      // Enlever les blocs de code
      .replace(/```[\s\S]*?```/g, 'bloc de code')
      // Enlever le code inline
      .replace(/`[^`]+`/g, '')
      // Enlever les liens markdown mais garder le texte
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Enlever les images markdown
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, 'image: $1')
      // Enlever les headers markdown
      .replace(/#{1,6}\s*/g, '')
      // Enlever les caractères de formatage
      .replace(/[*_~]/g, '')
      // Enlever les emojis courants (optionnel, certains TTS les gèrent mal)
      .replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/g, '')
      .replace(/[\u2600-\u27BF]/g, '')
      // Nettoyer les espaces multiples
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  // Parler un texte
  const speak = useCallback((text: string) => {
    if (!state.isSupported) {
      console.warn('Text-to-Speech non supporté par ce navigateur');
      return;
    }

    // Arrêter toute lecture en cours
    window.speechSynthesis.cancel();

    const cleanedText = cleanTextForSpeech(text);
    if (!cleanedText) return;

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    if (state.currentVoice) {
      utterance.voice = state.currentVoice;
    }

    utterance.onstart = () => {
      setState(prev => ({ ...prev, isSpeaking: true, isPaused: false }));
    };

    utterance.onend = () => {
      setState(prev => ({ ...prev, isSpeaking: false, isPaused: false }));
    };

    utterance.onerror = (event) => {
      console.error('Erreur TTS:', event.error);
      setState(prev => ({ ...prev, isSpeaking: false, isPaused: false }));
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [state.isSupported, state.currentVoice, lang, rate, pitch, volume, cleanTextForSpeech]);

  // Mettre en pause
  const pause = useCallback(() => {
    if (state.isSupported && state.isSpeaking) {
      window.speechSynthesis.pause();
      setState(prev => ({ ...prev, isPaused: true }));
    }
  }, [state.isSupported, state.isSpeaking]);

  // Reprendre
  const resume = useCallback(() => {
    if (state.isSupported && state.isPaused) {
      window.speechSynthesis.resume();
      setState(prev => ({ ...prev, isPaused: false }));
    }
  }, [state.isSupported, state.isPaused]);

  // Arrêter
  const stop = useCallback(() => {
    if (state.isSupported) {
      window.speechSynthesis.cancel();
      setState(prev => ({ ...prev, isSpeaking: false, isPaused: false }));
    }
  }, [state.isSupported]);

  // Changer la voix
  const setVoice = useCallback((voice: SpeechSynthesisVoice) => {
    setState(prev => ({ ...prev, currentVoice: voice }));
  }, []);

  // Nettoyer à la destruction du composant
  useEffect(() => {
    return () => {
      if (state.isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [state.isSupported]);

  return {
    ...state,
    speak,
    pause,
    resume,
    stop,
    setVoice
  };
}

export default useTextToSpeech;
