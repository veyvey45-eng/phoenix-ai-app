import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Brain, User, Sparkles, AlertTriangle, ChevronDown, ChevronUp, Radio, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Streamdown } from "streamdown";
import { CompactHypotheses } from "./HypothesesPanel";
import { TormentBar } from "./TormentGauge";
import { TTSButton } from "./TextToSpeech";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
                  onCheckedChange={setLiveMode}
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
                  onCheckedChange={setAutoTTS}
                />
                <Label htmlFor="auto-tts" className="text-xs flex items-center gap-1 cursor-pointer">
                  <Volume2 className="w-3 h-3" />
                  Voix
                </Label>
              </div>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez une question à Phoenix..."
              className="min-h-[60px] max-h-[200px] resize-none bg-card"
              disabled={isLoading}
            />
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
          </p>
        </div>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function MessageBubble({ message, isExpanded, onToggleExpand }: MessageBubbleProps) {
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
                
                {/* TTS Button */}
                <TTSButton text={message.content} className="ml-auto" />
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
                        <div className="mt-2 p-2 bg-muted/30 rounded-md">
                          <CompactHypotheses 
                            hypotheses={message.hypotheses} 
                            chosenId={message.chosenHypothesisId} 
                          />
                          
                          {message.reasoning && (
                            <p className="text-xs text-muted-foreground mt-2 italic">
                              {message.reasoning}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-xs text-muted-foreground mt-1">
          {new Date(message.timestamp).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit"
          })}
        </span>
      </div>
    </motion.div>
  );
}
