import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, MessageSquare, Code2 } from "lucide-react";
import { Streamdown } from "streamdown";
import { ConversationsList } from "@/components/ConversationsList";
import { FileUpload } from "@/components/FileUpload";
import { CodeExecutorTab } from "@/components/CodeExecutorTab";
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
  const [showCodeExecutor, setShowCodeExecutor] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{id: string; name: string; content: string} | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Queries
  const phoenixState = trpc.phoenix.getState.useQuery(undefined, {
    enabled: false
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
      // Use POST for file content to avoid URL length limits
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
      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
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
              } else if (data.type === 'error') {
                fullContent += `\n\n❌ ${data.content}`;
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
              <h1 className="text-lg font-semibold">Phoenix</h1>
              <p className="text-xs text-muted-foreground">
                {showCodeExecutor ? 'Code Executor' : conversationId ? `Conversation #${conversationId}` : 'Nouvelle conversation'}
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
            {!showCodeExecutor && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConversations(!showConversations)}
                className="gap-2"
              >
                {showConversations ? 'Masquer' : 'Conversations'}
              </Button>
            )}
            <Button
              variant={showCodeExecutor ? "default" : "outline"}
              size="sm"
              onClick={() => setShowCodeExecutor(!showCodeExecutor)}
              className="gap-2"
            >
              <Code2 className="w-4 h-4" />
              {showCodeExecutor ? 'Chat' : 'Code'}
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex gap-4 overflow-hidden p-4">
          {/* Conversations sidebar */}
          {!showCodeExecutor && showConversations && (
            <div className="w-64 border border-border rounded-lg overflow-hidden flex flex-col bg-card">
              <ConversationsList
                onSelectConversation={handleSelectConversation}
              />
            </div>
          )}

          {/* Content area */}
          {showCodeExecutor ? (
            <div className="flex-1 border border-border rounded-lg bg-card overflow-hidden p-4 overflow-y-auto">
              <CodeExecutorTab />
            </div>
          ) : (
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
                </div>
              </ScrollArea>

              {/* Input area */}
              <div className="border-t border-border p-4 space-y-2 bg-background/50">
                {showFileUpload && (
                  <div className="mb-4">
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
                          // Le contenu sera chargé par FileUpload via loadFileContent
                          toast.info(`Chargement du contenu de ${file.originalName}...`);
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
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
