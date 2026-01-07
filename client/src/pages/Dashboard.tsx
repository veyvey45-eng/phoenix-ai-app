import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, MessageSquare, Paperclip, Plus, History, Wrench, ExternalLink, CheckCircle2, XCircle, Brain, Sparkles } from "lucide-react";
import { SpeakButton } from "@/components/SpeakButton";
import { VoiceLiveMode } from "@/components/VoiceLiveMode";
import { Streamdown } from "streamdown";
import { ConversationsList } from "@/components/ConversationsList";
import { FileUpload } from "@/components/FileUpload";
import { toast } from "sonner";

// Generate UUID
const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Types pour les événements de l'agent
interface AgentAction {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'artifact';
  tool?: string;
  args?: any;
  result?: {
    success: boolean;
    output?: string;
    error?: string;
    artifacts?: any[];
  };
  content?: string;
  artifacts?: any[];
  timestamp: Date;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  images?: string[];
  agentActions?: AgentAction[]; // Actions de l'agent inline
  artifacts?: any[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [contextId, setContextId] = useState<string>(() => generateId());
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [showConversations, setShowConversations] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{id: string; name: string; content: string} | null>(null);
  const [currentThinking, setCurrentThinking] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const conversationMutation = trpc.conversations.create.useMutation();
  const saveMessageMutation = trpc.conversations.saveMessage.useMutation();

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentThinking, currentTool]);

  // Ensure conversation exists before sending message
  const ensureConversation = useCallback(async (): Promise<number | null> => {
    if (conversationId) {
      return conversationId;
    }
    
    return new Promise<number | null>((resolve) => {
      conversationMutation.mutate({}, {
        onSuccess: (conversation) => {
          if (conversation) {
            setConversationId(conversation.id);
            setContextId(conversation.contextId);
            setTimeout(() => resolve(conversation.id), 100);
          } else {
            resolve(null);
          }
        },
        onError: () => resolve(null)
      });
    });
  }, [conversationId, conversationMutation]);

  // Handle send message - utilise maintenant le endpoint unifié
  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const convId = await ensureConversation();
    if (!convId) {
      toast.error("Impossible de créer la conversation");
      return;
    }

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const sentInput = input;
    setInput("");
    setIsLoading(true);
    setCurrentThinking(null);
    setCurrentTool(null);

    try {
      // Utiliser le nouveau endpoint unifié avec capacités d'agent
      const response = await fetch('/api/stream/unified', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          conversationId: convId,
          message: sentInput,
          fileContent: uploadedFile?.content || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      let fullContent = "";
      let generatedImages: string[] = [];
      let agentActions: AgentAction[] = [];
      let artifacts: any[] = [];
      
      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
        images: [],
        agentActions: [],
        artifacts: []
      };
      setMessages(prev => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(dataStr);
              
              if (data.type === 'token') {
                fullContent += data.content;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: fullContent
                  };
                  return updated;
                });
              } else if (data.type === 'thinking') {
                // L'agent réfléchit
                setCurrentThinking(data.content);
                agentActions.push({
                  type: 'thinking',
                  content: data.content,
                  timestamp: new Date()
                });
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    agentActions: [...agentActions]
                  };
                  return updated;
                });
              } else if (data.type === 'tool_call') {
                // L'agent appelle un outil
                setCurrentThinking(null);
                setCurrentTool(data.tool);
                agentActions.push({
                  type: 'tool_call',
                  tool: data.tool,
                  args: data.args,
                  timestamp: new Date()
                });
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    agentActions: [...agentActions]
                  };
                  return updated;
                });
              } else if (data.type === 'tool_result') {
                // Résultat de l'outil
                setCurrentTool(null);
                agentActions.push({
                  type: 'tool_result',
                  tool: data.tool,
                  result: data.result,
                  timestamp: new Date()
                });
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    agentActions: [...agentActions]
                  };
                  return updated;
                });
                
                // Si le résultat contient des artifacts
                if (data.result?.artifacts) {
                  artifacts.push(...data.result.artifacts);
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      ...updated[updated.length - 1],
                      artifacts: [...artifacts]
                    };
                    return updated;
                  });
                }
              } else if (data.type === 'artifact') {
                // Artifact généré
                if (data.artifacts) {
                  artifacts.push(...data.artifacts);
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      ...updated[updated.length - 1],
                      artifacts: [...artifacts]
                    };
                    return updated;
                  });
                }
              } else if (data.type === 'image') {
                // Image générée
                generatedImages.push(data.url);
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    images: [...generatedImages]
                  };
                  return updated;
                });
              } else if (data.type === 'error') {
                fullContent += `\n\n❌ ${data.message || data.content}`;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: fullContent
                  };
                  return updated;
                });
              } else if (data.type === 'done') {
                setCurrentThinking(null);
                setCurrentTool(null);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      // Save messages to database
      saveMessageMutation.mutate({
        conversationId: convId,
        role: 'user',
        content: sentInput
      });
      saveMessageMutation.mutate({
        conversationId: convId,
        role: 'assistant',
        content: fullContent
      });

      setUploadedFile(null);
      setCurrentThinking(null);
      setCurrentTool(null);
    } catch (error) {
      console.error('Error:', error);
      toast.error("Erreur lors de l'envoi du message");
    } finally {
      setIsLoading(false);
      setCurrentThinking(null);
      setCurrentTool(null);
    }
  }, [input, isLoading, conversationId, ensureConversation, uploadedFile, saveMessageMutation]);

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setContextId(generateId());
    setUploadedFile(null);
    setCurrentThinking(null);
    setCurrentTool(null);
    toast.success("Nouvelle conversation créée");
  }, []);

  // Handle select conversation
  const handleSelectConversation = useCallback((id: number) => {
    setConversationId(id);
    setContextId(generateId());
    setMessages([]);
    setShowConversations(false);
  }, []);

  // Render agent action
  const renderAgentAction = (action: AgentAction, index: number) => {
    if (action.type === 'thinking') {
      return (
        <div key={index} className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-2 mb-2">
          <Brain className="w-4 h-4 mt-0.5 text-purple-500" />
          <span className="italic">{action.content}</span>
        </div>
      );
    }
    
    if (action.type === 'tool_call') {
      return (
        <div key={index} className="flex items-center gap-2 text-sm bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 mb-2">
          <Wrench className="w-4 h-4 text-blue-500" />
          <span className="font-medium text-blue-600 dark:text-blue-400">{action.tool}</span>
          {action.args && Object.keys(action.args).length > 0 && (
            <code className="text-xs bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded">
              {JSON.stringify(action.args).substring(0, 100)}...
            </code>
          )}
        </div>
      );
    }
    
    if (action.type === 'tool_result') {
      const isSuccess = action.result?.success;
      return (
        <div key={index} className={`flex items-start gap-2 text-sm rounded-lg p-2 mb-2 ${
          isSuccess ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
        }`}>
          {isSuccess ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 mt-0.5 text-red-500" />
          )}
          <div className="flex-1 min-w-0">
            <span className="font-medium">{action.tool}</span>
            {action.result?.output && (
              <pre className="text-xs mt-1 whitespace-pre-wrap break-all opacity-80 max-h-32 overflow-auto">
                {action.result.output.substring(0, 500)}
                {action.result.output.length > 500 && '...'}
              </pre>
            )}
            {action.result?.error && (
              <p className="text-xs mt-1 text-red-600 dark:text-red-400">{action.result.error}</p>
            )}
          </div>
        </div>
      );
    }
    
    return null;
  };

  // Render artifacts
  const renderArtifacts = (artifacts: any[]) => {
    return artifacts.map((artifact, idx) => {
      // Images générées
      if (artifact.type === 'image') {
        return (
          <div key={idx} className="rounded-lg overflow-hidden border border-border mt-2">
            <img 
              src={artifact.content} 
              alt={artifact.name || 'Image générée'}
              className="w-full max-w-md rounded-lg"
              loading="lazy"
              onError={(e) => {
                console.error('Image load error:', artifact.content);
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="50%" y="50%" text-anchor="middle" fill="gray">Image non disponible</text></svg>';
              }}
            />
            {artifact.name && (
              <div className="p-2 bg-muted/50 text-xs text-muted-foreground">
                {artifact.name}
              </div>
            )}
          </div>
        );
      }
      if (artifact.type === 'url' || artifact.type === 'preview_url') {
        return (
          <a
            key={idx}
            href={artifact.content}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm bg-primary/10 border border-primary/20 rounded-lg p-3 hover:bg-primary/20 transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-primary" />
            <span className="font-medium">{artifact.name || 'Voir le résultat'}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{artifact.content}</span>
          </a>
        );
      }
      if (artifact.type === 'code') {
        return (
          <div key={idx} className="bg-muted rounded-lg p-3 mt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">{artifact.name || 'Code'}</span>
            </div>
            <pre className="text-xs overflow-auto max-h-48">
              <code>{artifact.content}</code>
            </pre>
          </div>
        );
      }
      // Fichiers génériques
      if (artifact.type === 'file') {
        return (
          <a
            key={idx}
            href={artifact.content}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm bg-muted border border-border rounded-lg p-3 hover:bg-muted/80 transition-colors"
          >
            <Paperclip className="w-4 h-4" />
            <span className="font-medium">{artifact.name || 'Fichier'}</span>
          </a>
        );
      }
      return null;
    });
  };

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b border-border px-4 py-3 flex items-center justify-between bg-background/50">
          <div className="flex items-center gap-3">
            <div className="relative">
              <MessageSquare className="w-5 h-5 text-primary" />
              <Sparkles className="w-3 h-3 text-yellow-500 absolute -top-1 -right-1" />
            </div>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                Phoenix AI
                <Badge variant="secondary" className="text-xs font-normal">
                  Agent Unifié
                </Badge>
              </h1>
              <h2 className="text-xs text-muted-foreground">
                {conversationId ? `Conversation #${conversationId}` : 'Chat intelligent avec capacités d\'agent intégrées'}
              </h2>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewConversation}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Nouvelle
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConversations(!showConversations)}
              className="gap-2"
            >
              <History className="w-4 h-4" />
              {showConversations ? 'Masquer' : 'Conversations'}
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex gap-4 overflow-hidden p-4">
          {/* Conversations sidebar */}
          {showConversations && (
            <div className="w-64 border border-border rounded-lg overflow-hidden flex flex-col bg-card">
              <ConversationsList
                onSelectConversation={handleSelectConversation}
              />
            </div>
          )}

          {/* Chat area */}
          <div className="flex-1 flex flex-col border border-border rounded-lg bg-card overflow-hidden">
            {/* Messages */}
            <ScrollArea ref={scrollRef} className="flex-1 p-4">
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center text-muted-foreground py-20">
                    <div>
                      <div className="relative inline-block mb-4">
                        <MessageSquare className="w-12 h-12 opacity-50" />
                        <Sparkles className="w-6 h-6 text-yellow-500 absolute -top-2 -right-2" />
                      </div>
                      <p className="text-lg mb-2">Phoenix AI - Agent Unifié</p>
                      <p className="text-sm opacity-70 max-w-md">
                        Posez une question, demandez de créer un site web, d'exécuter du code, 
                        de rechercher sur Internet, ou de générer des images. Tout fonctionne ici!
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center mt-4">
                        <Badge variant="outline" className="text-xs">💬 Conversation</Badge>
                        <Badge variant="outline" className="text-xs">🌐 Création web</Badge>
                        <Badge variant="outline" className="text-xs">💻 Exécution code</Badge>
                        <Badge variant="outline" className="text-xs">🔍 Recherche web</Badge>
                        <Badge variant="outline" className="text-xs">🎨 Génération images</Badge>
                      </div>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted text-foreground border border-border rounded-bl-md'
                        }`}
                      >
                        {message.role === 'assistant' ? (
                          <div className="space-y-3">
                            {/* Actions de l'agent */}
                            {message.agentActions && message.agentActions.length > 0 && (
                              <div className="space-y-1 mb-3">
                                {message.agentActions.map((action, idx) => renderAgentAction(action, idx))}
                              </div>
                            )}
                            
                            {/* Contenu principal */}
                            <Streamdown>{message.content}</Streamdown>
                            
                            {/* Artifacts */}
                            {message.artifacts && message.artifacts.length > 0 && (
                              <div className="mt-4 space-y-2">
                                {renderArtifacts(message.artifacts)}
                              </div>
                            )}
                            
                            {/* Images générées */}
                            {message.images && message.images.length > 0 && (
                              <div className="mt-4 space-y-2">
                                {message.images.map((imgUrl, idx) => (
                                  <div key={idx} className="rounded-lg overflow-hidden border border-border">
                                    <img 
                                      src={imgUrl} 
                                      alt={`Image générée ${idx + 1}`}
                                      className="w-full max-w-md rounded-lg"
                                      loading="lazy"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Bouton pour écouter */}
                            {message.content && (
                              <div className="flex items-center gap-2 pt-2 border-t border-border/50 mt-3">
                                <SpeakButton 
                                  text={message.content} 
                                  size="sm"
                                  variant="ghost"
                                  showLabel
                                  className="text-xs opacity-70 hover:opacity-100"
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
                
                {/* Current thinking/tool indicator */}
                {(currentThinking || currentTool) && (
                  <div className="flex justify-start">
                    <div className="bg-muted text-foreground border border-border px-4 py-3 rounded-2xl rounded-bl-md max-w-[85%]">
                      {currentThinking && (
                        <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
                          <Brain className="w-4 h-4 animate-pulse" />
                          <span className="italic">{currentThinking}</span>
                        </div>
                      )}
                      {currentTool && (
                        <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Exécution de <strong>{currentTool}</strong>...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Loading indicator */}
                {isLoading && !currentThinking && !currentTool && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                  <div className="flex justify-start">
                    <div className="bg-muted text-foreground border border-border px-4 py-3 rounded-2xl rounded-bl-md">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Phoenix analyse votre demande...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Uploaded file indicator */}
            {uploadedFile && (
              <div className="mx-4 mb-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-primary" />
                  <span className="text-sm">{uploadedFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({uploadedFile.content.length.toLocaleString()} caractères)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUploadedFile(null)}
                  className="h-6 px-2"
                >
                  ✕
                </Button>
              </div>
            )}

            {/* File upload area */}
            {showFileUpload && (
              <div className="mx-4 mb-2">
                <FileUpload
                  onFileUploaded={(file) => {
                    if (file.extractedText) {
                      setUploadedFile({
                        id: file.id,
                        name: file.originalName,
                        content: file.extractedText
                      });
                      setShowFileUpload(false);
                      toast.success(`${file.originalName} uploadé`);
                    }
                  }}
                  onFileSelected={async (file) => {
                    if (file.extractedText && file.extractedText !== '__HAS_CONTENT__') {
                      setUploadedFile({
                        id: file.id,
                        name: file.originalName,
                        content: file.extractedText
                      });
                      setShowFileUpload(false);
                      toast.success(`${file.originalName} sélectionné`);
                    } else if (file.extractedText === '__HAS_CONTENT__') {
                      toast.info(`Chargement du contenu de ${file.originalName}...`);
                    }
                  }}
                />
              </div>
            )}

            {/* Input area */}
            <div className="border-t border-border p-4 bg-background/50">
              {/* Mode Live Voice */}
              <div className="mb-3 max-w-3xl mx-auto">
                <VoiceLiveMode
                  onSendMessage={async (message) => {
                    const convId = await ensureConversation();
                    if (!convId) return '';
                    
                    const userMessage: Message = {
                      id: generateId(),
                      role: 'user',
                      content: message,
                      timestamp: new Date()
                    };
                    setMessages(prev => [...prev, userMessage]);
                    
                    try {
                      const response = await fetch('/api/stream/unified', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          message,
                          contextId,
                          conversationId: convId
                        })
                      });
                      
                      if (!response.ok) return '';
                      
                      const reader = response.body?.getReader();
                      if (!reader) return '';
                      
                      let fullResponse = '';
                      const decoder = new TextDecoder();
                      
                      while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        
                        const chunk = decoder.decode(value);
                        const lines = chunk.split('\n');
                        
                        for (const line of lines) {
                          if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;
                            try {
                              const parsed = JSON.parse(data);
                              if (parsed.type === 'token' && parsed.content) {
                                fullResponse += parsed.content;
                              }
                            } catch {}
                          }
                        }
                      }
                      
                      if (fullResponse) {
                        const assistantMessage: Message = {
                          id: generateId(),
                          role: 'assistant',
                          content: fullResponse,
                          timestamp: new Date()
                        };
                        setMessages(prev => [...prev, assistantMessage]);
                      }
                      
                      return fullResponse;
                    } catch {
                      return '';
                    }
                  }}
                  isProcessing={isLoading}
                />
              </div>
              
              <div className="flex gap-2 items-end max-w-3xl mx-auto">
                <Button
                  onClick={() => setShowFileUpload(!showFileUpload)}
                  variant="outline"
                  size="icon"
                  title="Ajouter un fichier"
                  className="h-10 w-10 shrink-0"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Posez une question, demandez de créer un site, d'exécuter du code..."
                  className="min-h-[44px] max-h-32 resize-none"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="h-10 w-10 shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              
              <p className="text-xs text-center text-muted-foreground mt-2 max-w-3xl mx-auto">
                Phoenix peut créer des sites web, exécuter du code, rechercher sur Internet et générer des images - tout depuis ce chat!
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
