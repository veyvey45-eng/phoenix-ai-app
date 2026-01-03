import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, MessageSquare } from "lucide-react";
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

  // Queries
  const phoenixState = trpc.phoenix.getState.useQuery(undefined, {
    enabled: false // Disable auto-refetch to prevent page refresh issues
  });

  const conversationMutation = trpc.conversations.create.useMutation();

  const saveMessageMutation = trpc.conversations.saveMessage.useMutation();
  const analyzeFileMutation = trpc.files.analyze.useMutation();

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

  // Handle sending message
  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    let userContent = input.trim();
    let fileContent: string | undefined;
    
    if (uploadedFile) {
      fileContent = uploadedFile.content;
      // NE PAS réinitialiser uploadedFile ici - garder le fichier pour les questions suivantes
      // L'utilisateur peut le supprimer explicitement s'il le souhaite
    }
    
    setInput("");

    // Ensure conversation exists and get its ID
    const conversationIdFromEnsure = await ensureConversation();

    // Add user message immediately
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: userContent,
      timestamp: new Date()
    };
    
    // Add placeholder for assistant message
    const assistantMessageId = generateId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date()
    };
    
      // Add both messages at once to prevent race conditions
      setMessages(prev => [...prev, userMessage, assistantMessage]);

      setIsLoading(true);
      
      // Log fileContent transmission for debugging
      console.log('[Dashboard] fileContent transmission:', {
        hasFileContent: !!fileContent,
        fileContentLength: fileContent ? fileContent.length : 0,
        uploadedFileName: uploadedFile?.name
      });
    
    // Don't reload from database while sending
    const originalMessages = [userMessage, assistantMessage];

    let fullContent = ''; // Declare outside try-catch to use in save messages
    
    try {
      console.log('[Dashboard] Sending message with conversationId:', conversationIdFromEnsure);
      
      // Add timeout to fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      try {
        const response = await fetch(`/api/stream/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: userContent,
            fileContent,
            contextId,
            conversationId: conversationIdFromEnsure || 0
          }),
          signal: controller.signal
        });
        
        if (!response.ok) {
          console.error('[Dashboard] Stream response error:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('[Dashboard] Error response:', errorText);
          // Clear uploaded file on error to avoid confusion
          setUploadedFile(null);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        clearTimeout(timeoutId);

        const reader = response.body?.getReader();
        if (!reader) {
          console.error('[Dashboard] No response body');
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          try {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  if (parsed.type === 'token') {
                    fullContent += parsed.content;
                    setMessages(prev =>
                      prev.map(msg =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: fullContent }
                          : msg
                      )
                    );
                  } else if (parsed.type === 'error') {
                    console.error('[Dashboard] Stream error:', parsed.message);
                  }
                } catch (e) {
                  console.error('[Dashboard] Failed to parse stream data:', e);
                }
              }
            }
          } catch (streamError) {
            console.error('[Dashboard] Stream read error:', streamError);
            if (streamError instanceof Error && streamError.name === 'AbortError') {
              throw new Error('Request timeout - Phoenix took too long to respond');
            }
            throw streamError;
          }
        }
      } finally {
        clearTimeout(timeoutId);
      }

      // Save messages to database - use final conversationId
      const finalConversationId = conversationIdFromEnsure; // fullContent is already defined
      console.log('[Dashboard] Saving messages for conversation:', finalConversationId);
      if (finalConversationId) {
        try {
          // Save user message
          console.log('[Dashboard] Saving user message...');
          const userRes = await fetch('/api/save-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationId: finalConversationId,
              role: 'user',
              content: userContent
            })
          });
          const userResData = await userRes.json();
          console.log('[Dashboard] User message response:', userResData);

          // Save assistant message
          console.log('[Dashboard] Saving assistant message...');
          const assistantRes = await fetch('/api/save-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationId: finalConversationId,
              role: 'assistant',
              content: fullContent
            })
          });
          const assistantResData = await assistantRes.json();
          console.log('[Dashboard] Assistant message response:', assistantResData);
        } catch (error) {
          console.error('[Dashboard] Failed to save messages:', error);
        }
      } else {
        console.log('[Dashboard] No conversation ID to save messages');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erreur lors de la communication avec Phoenix');
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, contextId, conversationId, ensureConversation, saveMessageMutation]);

  // Query to get conversation messages
  const getConversationQuery = trpc.conversations.get.useQuery(
    { conversationId: conversationId || 0 },
    { 
      enabled: !!conversationId,
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false
    }
  );

  // Load messages when conversation changes
  useEffect(() => {
    // Only load messages from database if we have local messages already
    // This prevents clearing messages that were just sent
    if (messages.length > 0) {
      return;
    }
    
    if (getConversationQuery.data?.messages) {
      const loadedMessages: Message[] = getConversationQuery.data.messages.map(msg => ({
        id: generateId(),
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.createdAt)
      }));
      setMessages(loadedMessages);
    } else if (conversationId && !getConversationQuery.isLoading && getConversationQuery.data === undefined) {
      // If conversation is selected but no messages, show empty
      setMessages([]);
    }
  }, [getConversationQuery.data, conversationId, getConversationQuery.isLoading, messages.length]);

  // Handle conversation selection
  const handleSelectConversation = useCallback((convId: number, convContextId: string) => {
    setConversationId(convId);
    setContextId(convContextId);
    setMessages([]); // Clear messages when switching conversations
    setShowConversations(false);
    // Force refetch of messages
    getConversationQuery.refetch();
  }, [getConversationQuery]);
  
  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    setConversationId(null);
    setContextId(generateId());
    setMessages([]);
    setUploadedFile(null);
    setShowConversations(false);
  }, []);

  const state = phoenixState.data;

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b border-border px-4 py-3 flex items-center justify-between bg-background/50">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">Phoenix Chat</h1>
              <p className="text-xs text-muted-foreground">
                {conversationId ? `Conversation #${conversationId}` : 'Nouvelle conversation'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewConversation}
              className="gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Nouvelle
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConversations(!showConversations)}
              className="gap-2"
            >
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
              <div className="space-y-4 max-w-2xl mx-auto">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center text-muted-foreground py-20">
                    <div>
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Aucun message. Commencez une conversation!</p>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground border border-border'
                        }`}
                      >
                        {message.role === 'assistant' ? (
                          <Streamdown>{message.content}</Streamdown>
                        ) : (
                          <p className="text-sm">{message.content}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted border border-border px-4 py-2 rounded-lg flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Phoenix réfléchit...</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className="border-t border-border p-4 bg-background/50 space-y-2">
              {showFileUpload && (
                <div className="border border-dashed border-green-600 rounded-lg p-3 bg-green-600/5">
                  <FileUpload
                    maxFiles={1}
                    onFileUploaded={(file) => {
                      if (file.extractedText) {
                        setUploadedFile({
                          id: file.id,
                          name: file.originalName,
                          content: file.extractedText
                        });
                        setShowFileUpload(false);
                        toast.success(`${file.originalName} uploadé. Analyse en cours...`);
                        analyzeFileMutation.mutate(
                          { fileId: file.id, fileName: file.originalName },
                          {
                            onSuccess: (result) => {
                              if (result.success && result.analysis) {
                                const analysisMessage: Message = {
                                  id: generateId(),
                                  role: 'assistant',
                                  content: `**Analyse de ${result.fileName}:**\n\n${result.analysis}`,
                                  timestamp: new Date()
                                };
                                setMessages(prev => [...prev, analysisMessage]);
                                toast.success('Analyse complétée');
                              }
                            },
                            onError: () => {
                              // Error is handled silently - Groq limit reached, fallback to Google AI
                            }
                          }
                        );
                      } else {
                        toast.error(`Impossible d'extraire le contenu de ${file.originalName}`);
                      }
                    }}
                    onFileSelected={(file) => {
                      // Charger le contenu du fichier depuis le serveur si disponible
                      if (file.extractedText) {
                        setUploadedFile({
                          id: file.id,
                          name: file.originalName,
                          content: file.extractedText
                        });
                        setShowFileUpload(false);
                        toast.success(`${file.originalName} selectione`);
                      }
                    }}
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Posez une question à Phoenix..."
                  className="min-h-12 resize-none flex-1"
                  disabled={isLoading}
                />
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => setShowFileUpload(!showFileUpload)}
                    variant="outline"
                    size="sm"
                    title="Ajouter un PDF ou document"
                    className="h-full"
                  >
                    📎
                  </Button>
                  <Button
                    onClick={handleSendMessage}
                    disabled={isLoading || !input.trim()}
                    size="icon"
                    className="h-12 w-12"
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

        {/* Status bar */}
        {state && (
          <div className="border-t border-border px-4 py-2 bg-background/50 text-xs text-muted-foreground flex gap-4">
            <span>Torment: {state.tormentScore}</span>
            <span>Issues: {state.openIssuesCount}</span>
            <span>Decisions: {state.totalDecisions}</span>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
