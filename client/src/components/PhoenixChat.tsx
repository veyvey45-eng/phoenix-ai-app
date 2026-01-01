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
  Paperclip 
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
  onSendMessage: (message: string) => Promise<void>;
  isLoading?: boolean;
  currentTorment?: number;
  isStreaming?: boolean;
}

export function PhoenixChat({ 
  messages, 
  onSendMessage, 
  isLoading = false,
  currentTorment = 0,
  isStreaming = false
}: PhoenixChatProps) {
  const [input, setInput] = useState("");
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [liveMode, setLiveMode] = useState(false);
  const [autoTTS, setAutoTTS] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  
  // Speech synthesis hook
  const speech = useSpeechSynthesis();

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
    await onSendMessage(message);
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
                    const fileInfo = `[Fichier: ${file.originalName}]`;
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

// Voice settings popover
function VoiceSettings({ speech }: { speech: ReturnType<typeof useSpeechSynthesis> }) {
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
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Paramètres de la voix</h4>
          
          {/* Voice selection */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Voix</label>
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

          {/* Speed */}
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

          {/* Pitch */}
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

          {/* Volume */}
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

          {/* Test button */}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => speech.speak("Bonjour, je suis Phoenix, votre assistant intelligent.")}
          >
            <Volume2 className="h-3 w-3 mr-2" />
            Tester la voix
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface MessageBubbleProps {
  message: Message;
  isExpanded: boolean;
  onToggleExpand: () => void;
  speech: ReturnType<typeof useSpeechSynthesis>;
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

              {/* Hypotheses (collapsible) */}
              {message.hypotheses && message.hypotheses.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={onToggleExpand}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                    {message.hypotheses.length} hypothèses générées
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

              {/* Reasoning (if available) */}
              {message.reasoning && (
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
