import { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Pause, Play, Square, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface TextToSpeechProps {
  text: string;
  autoPlay?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSettings?: boolean;
}

interface VoiceOption {
  voice: SpeechSynthesisVoice;
  label: string;
}

export function TextToSpeech({ 
  text, 
  autoPlay = false, 
  className,
  size = 'md',
  showSettings = true
}: TextToSpeechProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isSupported, setIsSupported] = useState(true);
  
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Check browser support and load voices
  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setIsSupported(false);
      return;
    }

    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      
      // Filter and prioritize French voices
      const frenchVoices = availableVoices.filter(v => v.lang.startsWith('fr'));
      const otherVoices = availableVoices.filter(v => !v.lang.startsWith('fr'));
      
      const voiceOptions: VoiceOption[] = [
        ...frenchVoices.map(v => ({
          voice: v,
          label: `${v.name} (${v.lang})${v.localService ? '' : ' - Cloud'}`
        })),
        ...otherVoices.slice(0, 10).map(v => ({
          voice: v,
          label: `${v.name} (${v.lang})${v.localService ? '' : ' - Cloud'}`
        }))
      ];

      setVoices(voiceOptions);
      
      // Select default French voice if available
      const defaultFrench = frenchVoices.find(v => v.default) || frenchVoices[0];
      if (defaultFrench) {
        setSelectedVoice(defaultFrench.name);
      } else if (availableVoices.length > 0) {
        setSelectedVoice(availableVoices[0].name);
      }
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Auto-play effect
  useEffect(() => {
    if (autoPlay && text && isSupported) {
      speak();
    }
  }, [autoPlay, text]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (utteranceRef.current) {
        speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback(() => {
    if (!isSupported || !text) return;

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    // Set voice
    const voice = voices.find(v => v.voice.name === selectedVoice)?.voice;
    if (voice) {
      utterance.voice = voice;
    }

    // Set parameters
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

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
      console.error('Speech synthesis error:', event);
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onpause = () => {
      setIsPaused(true);
    };

    utterance.onresume = () => {
      setIsPaused(false);
    };

    speechSynthesis.speak(utterance);
  }, [text, selectedVoice, rate, pitch, volume, voices, isSupported]);

  const pause = useCallback(() => {
    if (isPlaying && !isPaused) {
      speechSynthesis.pause();
    }
  }, [isPlaying, isPaused]);

  const resume = useCallback(() => {
    if (isPlaying && isPaused) {
      speechSynthesis.resume();
    }
  }, [isPlaying, isPaused]);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!isPlaying) {
      speak();
    } else if (isPaused) {
      resume();
    } else {
      pause();
    }
  }, [isPlaying, isPaused, speak, resume, pause]);

  if (!isSupported) {
    return null; // Don't render if not supported
  }

  const sizeClasses = {
    sm: 'h-7 w-7',
    md: 'h-8 w-8',
    lg: 'h-10 w-10'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Main play/pause button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(sizeClasses[size], 'text-muted-foreground hover:text-foreground')}
        onClick={togglePlayPause}
        title={isPlaying ? (isPaused ? 'Reprendre' : 'Pause') : 'Lire à voix haute'}
      >
        {isPlaying ? (
          isPaused ? (
            <Play className={iconSizes[size]} />
          ) : (
            <Pause className={iconSizes[size]} />
          )
        ) : (
          <Volume2 className={iconSizes[size]} />
        )}
      </Button>

      {/* Stop button (only when playing) */}
      {isPlaying && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(sizeClasses[size], 'text-muted-foreground hover:text-foreground')}
          onClick={stop}
          title="Arrêter"
        >
          <Square className={iconSizes[size]} />
        </Button>
      )}

      {/* Settings popover */}
      {showSettings && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(sizeClasses[size], 'text-muted-foreground hover:text-foreground')}
              title="Paramètres de la voix"
            >
              <Settings className={iconSizes[size]} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="end">
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Paramètres de la voix</h4>
              
              {/* Voice selection */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Voix</label>
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Sélectionner une voix" />
                  </SelectTrigger>
                  <SelectContent>
                    {voices.map((v) => (
                      <SelectItem key={v.voice.name} value={v.voice.name} className="text-xs">
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Speed */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs text-muted-foreground">Vitesse</label>
                  <span className="text-xs text-muted-foreground">{rate.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[rate]}
                  onValueChange={([v]) => setRate(v)}
                  min={0.5}
                  max={2}
                  step={0.1}
                  className="w-full"
                />
              </div>

              {/* Pitch */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs text-muted-foreground">Tonalité</label>
                  <span className="text-xs text-muted-foreground">{pitch.toFixed(1)}</span>
                </div>
                <Slider
                  value={[pitch]}
                  onValueChange={([v]) => setPitch(v)}
                  min={0.5}
                  max={2}
                  step={0.1}
                  className="w-full"
                />
              </div>

              {/* Volume */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs text-muted-foreground">Volume</label>
                  <span className="text-xs text-muted-foreground">{Math.round(volume * 100)}%</span>
                </div>
                <Slider
                  value={[volume]}
                  onValueChange={([v]) => setVolume(v)}
                  min={0}
                  max={1}
                  step={0.1}
                  className="w-full"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// Simple inline TTS button for messages
export function TTSButton({ text, className }: { text: string; className?: string }) {
  return (
    <TextToSpeech 
      text={text} 
      size="sm" 
      showSettings={false}
      className={className}
    />
  );
}

export default TextToSpeech;
