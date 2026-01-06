/**
 * Hook useSpeechToText - Reconnaissance vocale pour parler à Phoenix
 * Utilise l'API Web Speech Recognition native du navigateur
 */

import { useState, useCallback, useEffect, useRef } from 'react';

// Types pour l'API Web Speech Recognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechToTextOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

interface SpeechToTextState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
}

export function useSpeechToText(options: SpeechToTextOptions = {}) {
  const {
    lang = 'fr-FR',
    continuous = false,
    interimResults = true,
    onResult,
    onError
  } = options;

  const [state, setState] = useState<SpeechToTextState>({
    isListening: false,
    isSupported: typeof window !== 'undefined' && 
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
    transcript: '',
    interimTranscript: '',
    error: null
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Initialiser la reconnaissance vocale
  useEffect(() => {
    if (!state.isSupported) return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();

    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState(prev => ({ ...prev, isListening: true, error: null }));
    };

    recognition.onend = () => {
      setState(prev => ({ ...prev, isListening: false }));
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = 'Erreur de reconnaissance vocale';
      
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'Aucune parole détectée';
          break;
        case 'audio-capture':
          errorMessage = 'Microphone non disponible';
          break;
        case 'not-allowed':
          errorMessage = 'Accès au microphone refusé';
          break;
        case 'network':
          errorMessage = 'Erreur réseau';
          break;
        case 'aborted':
          errorMessage = 'Reconnaissance annulée';
          break;
      }

      setState(prev => ({ ...prev, error: errorMessage, isListening: false }));
      onError?.(errorMessage);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        setState(prev => ({
          ...prev,
          transcript: prev.transcript + finalTranscript,
          interimTranscript: ''
        }));
        onResult?.(finalTranscript, true);
      } else {
        setState(prev => ({ ...prev, interimTranscript }));
        onResult?.(interimTranscript, false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [state.isSupported, lang, continuous, interimResults, onResult, onError]);

  // Démarrer l'écoute
  const startListening = useCallback(() => {
    if (!state.isSupported) {
      console.warn('Speech-to-Text non supporté par ce navigateur');
      return;
    }

    if (recognitionRef.current && !state.isListening) {
      setState(prev => ({ ...prev, transcript: '', interimTranscript: '', error: null }));
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Erreur au démarrage de la reconnaissance:', error);
      }
    }
  }, [state.isSupported, state.isListening]);

  // Arrêter l'écoute
  const stopListening = useCallback(() => {
    if (recognitionRef.current && state.isListening) {
      recognitionRef.current.stop();
    }
  }, [state.isListening]);

  // Annuler l'écoute
  const abortListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      setState(prev => ({ ...prev, isListening: false, interimTranscript: '' }));
    }
  }, []);

  // Réinitialiser le transcript
  const resetTranscript = useCallback(() => {
    setState(prev => ({ ...prev, transcript: '', interimTranscript: '' }));
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    abortListening,
    resetTranscript
  };
}

export default useSpeechToText;
