import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, MessageSquare, Paperclip, Plus, History, Volume2 } from "lucide-react";
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

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  images?: string[]; // URLs des images générées
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const conversationMutation = trpc.conversations.create.useMutation();
  const saveMessageMutation = trpc.conversations.saveMessage.useMutation();

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

  // Handle send message
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
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch('/api/stream/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          conversationId: convId,
          message: input,
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
      
      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
        images: []
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
              } else if (data.type === 'image') {
                // Image générée reçue
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
        content: input
      });
      saveMessageMutation.mutate({
        conversationId: convId,
        role: 'assistant',
        content: fullContent
      });

      setUploadedFile(null);
    } catch (error) {
      console.error('Error:', error);
      toast.error("Erreur lors de l'envoi du message");
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, conversationId, ensureConversation, uploadedFile, saveMessageMutation]);

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setContextId(generateId());
    setUploadedFile(null);
    toast.success("Nouvelle conversation créée");
  }, []);

  // Handle select conversation
  const handleSelectConversation = useCallback((id: number) => {
    setConversationId(id);
    setContextId(generateId());
    setMessages([]);
    setShowConversations(false);
  }, []);

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b border-border px-4 py-3 flex items-center justify-between bg-background/50">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">Phoenix AI - Assistant Intelligent</h1>
              <h2 className="text-xs text-muted-foreground">
                {conversationId ? `Conversation #${conversationId}` : 'Nouvelle conversation avec votre assistant IA'}
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
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg mb-2">Aucun message. Commencez une conversation!</p>
                      <p className="text-sm opacity-70">
                        Posez une question, demandez une image, ou discutez simplement.
                      </p>
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
                            <Streamdown>{message.content}</Streamdown>
                            
                            {/* Afficher les images générées */}
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
                            
                            {/* Bouton pour écouter le message */}
                            <div className="flex items-center gap-2 pt-2 border-t border-border/50 mt-3">
                              <SpeakButton 
                                text={message.content} 
                                size="sm"
                                variant="ghost"
                                showLabel
                                className="text-xs opacity-70 hover:opacity-100"
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
                
                {/* Loading indicator */}
                {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                  <div className="flex justify-start">
                    <div className="bg-muted text-foreground border border-border px-4 py-3 rounded-2xl rounded-bl-md">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Phoenix réfléchit...</span>
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
                    // Envoyer le message vocal et récupérer la réponse
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
                      const response = await fetch('/api/stream/chat', {
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
                  placeholder="Posez une question à Phoenix..."
                  className="min-h-10 max-h-32 resize-none flex-1"
                  disabled={isLoading}
                  rows={1}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={isLoading || !input.trim()}
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
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
