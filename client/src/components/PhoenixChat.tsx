import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, 
  Loader2, 
  Brain, 
  User, 
  Sparkles, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Radio, 
  Volume2, 
  VolumeX,
  Pause,
  Play,
  Square,
  Settings,
  Paperclip,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Streamdown } from "streamdown";
import { CompactHypotheses } from "./HypothesesPanel";
import { TormentBar } from "./TormentGauge";
import { FileUpload } from "./FileUpload";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { useServerTTS, AVAILABLE_VOICES, TTSVoice } from "@/hooks/useServerTTS";
import { toast } from "sonner";

interface Hypothesis {
  id: string;
  content: string;
  confidence: number;
  reasoning?: string;
  sources?: string[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  confidence?: number;
  hypotheses?: Hypothesis[];
  chosenHypothesisId?: string;
  tormentScore?: number;
  tormentChange?: number;
  reasoning?: string;
  timestamp: Date;
}

interface PhoenixChatProps {
  messages: Message[];
  onSendMessage: (message: string, fastMode?: boolean) => Promise<void>;
  isLoading?: boolean;
  currentTorment?: number;
  isStreaming?: boolean;
  fastMode?: boolean;
  onFastModeChange?: (enabled: boolean) => void;
}

export function PhoenixChat({ 
  messages, 
  onSendMessage, 
  isLoading = false,
  currentTorment = 0,
  isStreaming = false,
  fastMode = false,
  onFastModeChange
}: PhoenixChatProps) {
  const [input, setInput] = useState("");
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [liveMode, setLiveMode] = useState(false);
  const [autoTTS, setAutoTTS] = useState(false);
  const [localFastMode, setLocalFastMode] = useState(() => {
    // Récupérer la préférence depuis localStorage
    const saved = localStorage.getItem('phoenix-fast-mode');
    return saved ? JSON.parse(saved) : false;
  });
  
  // Utiliser le mode rapide local ou celui passé en props
  const isFastMode = onFastModeChange ? fastMode : localFastMode;
  
  const handleFastModeChange = (enabled: boolean) => {
    if (onFastModeChange) {
      onFastModeChange(enabled);
    } else {
      setLocalFastMode(enabled);
      localStorage.setItem('phoenix-fast-mode', JSON.stringify(enabled));
    }
    if (enabled) {
      toast.success("⚡ Mode Rapide activé - Réponses plus rapides (1 hypothèse)");
    } else {
      toast.info("Mode Rapide désactivé - Analyse complète (3 hypothèses)");
    }
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  
  // Speech synthesis hooks - browser and server fallback
  const browserSpeech = useSpeechSynthesis();
  const serverTTS = useServerTTS();
  
  // Use server TTS as fallback when browser TTS is not supported
  const [useServerMode, setUseServerMode] = useState(() => {
    const saved = localStorage.getItem('phoenix-use-server-tts');
    return saved ? JSON.parse(saved) : false;
  });
  
  // Combined speech interface
  const speech = {
    isSupported: browserSpeech.isSupported || serverTTS.isAvailable,
    isPlaying: useServerMode ? serverTTS.isPlaying : browserSpeech.isPlaying,
    isPaused: useServerMode ? serverTTS.isPaused : browserSpeech.isPaused,
    isLoading: serverTTS.isLoading,
    voices: browserSpeech.voices,
    currentVoice: browserSpeech.currentVoice,
    settings: browserSpeech.settings,
    serverSettings: serverTTS.settings,
    speak: async (text: string) => {
      if (useServerMode || !browserSpeech.isSupported) {
        await serverTTS.speak(text);
      } else {
        browserSpeech.speak(text);
      }
    },
    pause: () => {
      if (useServerMode) {
        serverTTS.pause();
      } else {
        browserSpeech.pause();
      }
    },
    resume: () => {
      if (useServerMode) {
        serverTTS.resume();
      } else {
        browserSpeech.resume();
      }
    },
    stop: () => {
      if (useServerMode) {
        serverTTS.stop();
      } else {
        browserSpeech.stop();
      }
    },
    setVoice: browserSpeech.setVoice,
    setRate: browserSpeech.setRate,
    setPitch: browserSpeech.setPitch,
    setVolume: browserSpeech.setVolume,
    togglePlayPause: (text: string) => {
      if (useServerMode || !browserSpeech.isSupported) {
        if (!serverTTS.isPlaying) {
          serverTTS.speak(text);
        } else if (serverTTS.isPaused) {
          serverTTS.resume();
        } else {
          serverTTS.pause();
        }
      } else {
        browserSpeech.togglePlayPause(text);
      }
    },
    // Server TTS specific
    serverTTS,
    useServerMode,
    setUseServerMode: (enabled: boolean) => {
      setUseServerMode(enabled);
      localStorage.setItem('phoenix-use-server-tts', JSON.stringify(enabled));
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-TTS: Read new assistant messages automatically
  useEffect(() => {
    if (!autoTTS || !speech.isSupported) return;
    
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage && 
      lastMessage.role === "assistant" && 
      lastMessage.id !== lastMessageIdRef.current
    ) {
      lastMessageIdRef.current = lastMessage.id;
      // Small delay to let the UI update
      setTimeout(() => {
        speech.speak(lastMessage.content);
        toast.info("🔊 Lecture automatique activée", { duration: 2000 });
      }, 500);
    }
  }, [messages, autoTTS, speech]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const message = input.trim();
    setInput("");
    await onSendMessage(message, isFastMode);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const toggleExpanded = (messageId: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const handleAutoTTSChange = (enabled: boolean) => {
    if (enabled && !speech.isSupported) {
      toast.error("La synthèse vocale n'est pas disponible sur cet appareil. Essayez avec un autre navigateur.");
      setAutoTTS(false);
      return;
    }
    setAutoTTS(enabled);
    if (enabled) {
      toast.success("🔊 Mode Voix activé - Phoenix parlera automatiquement");
    } else {
      try {
        speech.stop();
      } catch (e) {
        // Ignore stop errors
      }
      toast.info("Mode Voix désactivé");
    }
  };

  const handleLiveModeChange = (enabled: boolean) => {
    setLiveMode(enabled);
    if (enabled) {
      toast.success("🔴 Mode Live activé - Streaming en temps réel");
    } else {
      toast.info("Mode Live désactivé");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4 max-w-3xl mx-auto">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isExpanded={expandedMessages.has(message.id)}
                onToggleExpand={() => toggleExpanded(message.id)}
                speech={speech}
              />
            ))}
          </AnimatePresence>
          
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Brain className="w-4 h-4 text-primary animate-pulse" />
              </div>
              <div className="bg-card rounded-lg p-4 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Phoenix réfléchit...</span>
                </div>
                <div className="flex gap-1 mt-2">
                  <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-border p-4 bg-background/80 backdrop-blur">
        <div className="max-w-3xl mx-auto">
          {/* Controls row */}
          <div className="mb-3 flex items-center justify-between">
            <TormentBar score={currentTorment} />
            
            <div className="flex items-center gap-4">
              {/* Fast mode toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="fast-mode"
                  checked={isFastMode}
                  onCheckedChange={handleFastModeChange}
                  className="data-[state=checked]:bg-yellow-500"
                />
                <Label htmlFor="fast-mode" className="text-xs flex items-center gap-1 cursor-pointer">
                  <Zap className={cn("w-3 h-3", isFastMode && "text-yellow-500")} />
                  Rapide
                </Label>
              </div>
              
              {/* Live mode toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="live-mode"
                  checked={liveMode}
                  onCheckedChange={handleLiveModeChange}
                  className="data-[state=checked]:bg-red-500"
                />
                <Label htmlFor="live-mode" className="text-xs flex items-center gap-1 cursor-pointer">
                  <Radio className={cn("w-3 h-3", liveMode && "text-red-500 animate-pulse")} />
                  Live
                </Label>
              </div>
              
              {/* Auto TTS toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-tts"
                  checked={autoTTS}
                  onCheckedChange={handleAutoTTSChange}
                  className="data-[state=checked]:bg-green-500"
                />
                <Label htmlFor="auto-tts" className="text-xs flex items-center gap-1 cursor-pointer">
                  {autoTTS ? (
                    <Volume2 className="w-3 h-3 text-green-500" />
                  ) : (
                    <VolumeX className="w-3 h-3" />
                  )}
                  Voix
                </Label>
              </div>

              {/* Voice settings */}
              {speech.isSupported && (
                <VoiceSettings speech={speech} />
              )}
            </div>
          </div>
          
          {/* Now playing indicator */}
          {speech.isPlaying && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30"
            >
              <Volume2 className="w-4 h-4 text-green-500 animate-pulse" />
              <span className="text-xs text-green-500">Phoenix parle...</span>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => speech.isPaused ? speech.resume() : speech.pause()}
              >
                {speech.isPaused ? (
                  <Play className="h-3 w-3" />
                ) : (
                  <Pause className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={speech.stop}
              >
                <Square className="h-3 w-3" />
              </Button>
            </motion.div>
          )}
          
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Posez une question à Phoenix..."
                className="min-h-[60px] max-h-[200px] resize-none bg-card pr-10"
                disabled={isLoading}
              />
              <div className="absolute right-2 bottom-2">
                <FileUpload 
                  compact 
                  onFileUploaded={(file) => {
                    // Pass file ID so Phoenix can retrieve the full content
                    const fileInfo = `[FILE_ID:${file.id}]`;
                    setInput(prev => prev ? `${prev}\n${fileInfo}` : fileInfo);
                  }}
                />
              </div>
            </div>
            <Button 
              type="submit" 
              size="icon" 
              className="h-[60px] w-[60px] shrink-0"
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </form>
          
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Phoenix génère plusieurs hypothèses et sélectionne la meilleure réponse
            {autoTTS && " • 🔊 Lecture vocale automatique activée"}
          </p>
        </div>
      </div>
    </div>
  );
}

// Voice settings popover - supports both browser and server TTS
interface ExtendedSpeech {
  isSupported: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  isLoading?: boolean;
  voices: Array<{ voice: { name: string }; label: string; isCloud: boolean }>;
  currentVoice: string;
  settings: { rate: number; pitch: number; volume: number };
  serverSettings?: { voice: string; speed: number; volume: number };
  speak: (text: string) => void;
  setVoice: (name: string) => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVolume: (volume: number) => void;
  togglePlayPause: (text: string) => void;
  serverTTS?: {
    setVoice: (voice: TTSVoice) => void;
    setSpeed: (speed: number) => void;
    setVolume: (volume: number) => void;
    isAvailable: boolean;
  };
  useServerMode?: boolean;
  setUseServerMode?: (enabled: boolean) => void;
}

function VoiceSettings({ speech }: { speech: ExtendedSpeech }) {
  const hasServerTTS = speech.serverTTS?.isAvailable;
  const useServer = speech.useServerMode ?? false;
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          title="Paramètres de la voix"
        >
          <Settings className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Paramètres de la voix</h4>
          
          {/* Server TTS toggle */}
          {hasServerTTS && speech.setUseServerMode && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div className="flex flex-col">
                <span className="text-xs font-medium">Mode Serveur (IA)</span>
                <span className="text-xs text-muted-foreground">Voix haute qualité</span>
              </div>
              <Switch
                checked={useServer}
                onCheckedChange={speech.setUseServerMode}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>
          )}
          
          {useServer && speech.serverTTS && speech.serverSettings ? (
            // Server TTS settings
            <>
              {/* Server Voice selection */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Voix IA</label>
                <Select 
                  value={speech.serverSettings.voice} 
                  onValueChange={(v) => speech.serverTTS?.setVoice(v as TTSVoice)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Sélectionner une voix" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_VOICES.map((v) => (
                      <SelectItem key={v.value} value={v.value} className="text-xs">
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Server Speed */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs text-muted-foreground">Vitesse</label>
                  <span className="text-xs text-muted-foreground">{speech.serverSettings.speed.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[speech.serverSettings.speed]}
                  onValueChange={([v]) => speech.serverTTS?.setSpeed(v)}
                  min={0.5}
                  max={2}
                  step={0.1}
                  className="w-full"
                />
              </div>

              {/* Server Volume */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs text-muted-foreground">Volume</label>
                  <span className="text-xs text-muted-foreground">{Math.round(speech.serverSettings.volume * 100)}%</span>
                </div>
                <Slider
                  value={[speech.serverSettings.volume]}
                  onValueChange={([v]) => speech.serverTTS?.setVolume(v)}
                  min={0}
                  max={1}
                  step={0.1}
                  className="w-full"
                />
              </div>
            </>
          ) : (
            // Browser TTS settings
            <>
              {/* Browser Voice selection */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Voix navigateur</label>
                <Select value={speech.currentVoice} onValueChange={speech.setVoice}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Sélectionner une voix" />
                  </SelectTrigger>
                  <SelectContent>
                    {speech.voices.map((v) => (
                      <SelectItem key={v.voice.name} value={v.voice.name} className="text-xs">
                        {v.label} {v.isCloud && "☁️"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Browser Speed */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs text-muted-foreground">Vitesse</label>
                  <span className="text-xs text-muted-foreground">{speech.settings.rate.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[speech.settings.rate]}
                  onValueChange={([v]) => speech.setRate(v)}
                  min={0.5}
                  max={2}
                  step={0.1}
                  className="w-full"
                />
              </div>

              {/* Browser Pitch */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs text-muted-foreground">Tonalité</label>
                  <span className="text-xs text-muted-foreground">{speech.settings.pitch.toFixed(1)}</span>
                </div>
                <Slider
                  value={[speech.settings.pitch]}
                  onValueChange={([v]) => speech.setPitch(v)}
                  min={0.5}
                  max={2}
                  step={0.1}
                  className="w-full"
                />
              </div>

              {/* Browser Volume */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs text-muted-foreground">Volume</label>
                  <span className="text-xs text-muted-foreground">{Math.round(speech.settings.volume * 100)}%</span>
                </div>
                <Slider
                  value={[speech.settings.volume]}
                  onValueChange={([v]) => speech.setVolume(v)}
                  min={0}
                  max={1}
                  step={0.1}
                  className="w-full"
                />
              </div>
            </>
          )}

          {/* Test button */}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => speech.speak("Bonjour, je suis Phoenix, votre assistant intelligent.")}
            disabled={speech.isLoading}
          >
            <Volume2 className="h-3 w-3 mr-2" />
            {speech.isLoading ? "Chargement..." : "Tester la voix"}
          </Button>
          
          {!speech.isSupported && (
            <p className="text-xs text-muted-foreground text-center">
              Synthèse vocale non disponible sur ce navigateur
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface MessageBubbleProps {
  message: Message;
  isExpanded: boolean;
  onToggleExpand: () => void;
  speech: ExtendedSpeech;
}

function MessageBubble({ message, isExpanded, onToggleExpand, speech }: MessageBubbleProps) {
  const isUser = message.role === "user";
  
  const confidenceClass = message.confidence !== undefined
    ? message.confidence >= 0.8 
      ? "confidence-high" 
      : message.confidence >= 0.5 
        ? "confidence-medium" 
        : "confidence-low"
    : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "flex items-start gap-3",
        isUser && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
        isUser ? "bg-secondary" : "bg-primary/20"
      )}>
        {isUser ? (
          <User className="w-4 h-4 text-secondary-foreground" />
        ) : (
          <Brain className="w-4 h-4 text-primary" />
        )}
      </div>

      {/* Message content */}
      <div className={cn(
        "flex-1 max-w-[80%]",
        isUser && "flex flex-col items-end"
      )}>
        <div className={cn(
          "rounded-lg p-4 border",
          isUser 
            ? "bg-primary text-primary-foreground border-primary" 
            : "bg-card border-border"
        )}>
          {/* Message text */}
          <div className={cn("prose prose-sm max-w-none", !isUser && "dark:prose-invert")}>
            <Streamdown>{message.content}</Streamdown>
          </div>

          {/* Phoenix metadata (for assistant messages) */}
          {!isUser && (
            <div className="mt-3 pt-3 border-t border-border/50">
              {/* Confidence and torment */}
              <div className="flex items-center gap-3 flex-wrap">
                {message.confidence !== undefined && (
                  <Badge variant="outline" className={cn("text-xs", confidenceClass)}>
                    <Sparkles className="w-3 h-3 mr-1" />
                    Confiance: {(message.confidence * 100).toFixed(0)}%
                  </Badge>
                )}
                
                {message.tormentChange !== undefined && message.tormentChange !== 0 && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      message.tormentChange > 0 ? "text-red-400" : "text-green-400"
                    )}
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Tourment: {message.tormentChange > 0 ? "+" : ""}{message.tormentChange.toFixed(1)}
                  </Badge>
                )}
                
                {/* TTS Button - now functional */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 ml-auto text-muted-foreground hover:text-foreground"
                  onClick={() => speech.togglePlayPause(message.content)}
                  title={speech.isPlaying ? "Pause" : "Lire à voix haute"}
                >
                  {speech.isPlaying ? (
                    speech.isPaused ? (
                      <Play className="h-3 w-3" />
                    ) : (
                      <Pause className="h-3 w-3" />
                    )
                  ) : (
                    <Volume2 className="h-3 w-3" />
                  )}
                </Button>
              </div>

              {/* Hypotheses - masquées par défaut pour une réponse plus rapide */}
              {message.hypotheses && message.hypotheses.length > 1 && (
                <div className="mt-2">
                  <button
                    onClick={onToggleExpand}
                    className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                    <span className="opacity-70">
                      {isExpanded ? "Masquer" : "Voir"} les {message.hypotheses.length} hypothèses
                    </span>
                  </button>
                  
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2">
                          <CompactHypotheses
                            hypotheses={message.hypotheses}
                            chosenId={message.chosenHypothesisId}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Reasoning - masqué par défaut, visible seulement si hypothèses dépliées */}
              {isExpanded && message.reasoning && (
                <div className="mt-2 text-xs text-muted-foreground italic">
                  💭 {message.reasoning}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-xs text-muted-foreground mt-1">
          {new Date(message.timestamp).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </span>
      </div>
    </motion.div>
  );
}

export default PhoenixChat;
