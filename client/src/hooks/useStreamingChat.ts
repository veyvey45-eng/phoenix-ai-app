import { useState, useCallback, useRef } from 'react';

interface StreamingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming: boolean;
  confidence?: number;
  hypotheses?: Array<{
    id: string;
    content: string;
    confidence: number;
  }>;
  tormentScore?: number;
  tormentChange?: number;
  timestamp: Date;
}

interface UseStreamingChatOptions {
  contextId: string;
  onComplete?: (message: StreamingMessage) => void;
  onError?: (error: Error) => void;
}

interface StreamingChatReturn {
  messages: StreamingMessage[];
  sendMessage: (content: string) => Promise<void>;
  isStreaming: boolean;
  cancelStream: () => void;
  clearMessages: () => void;
}

export function useStreamingChat({
  contextId,
  onComplete,
  onError
}: UseStreamingChatOptions): StreamingChatReturn {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    // Add user message
    const userMessage: StreamingMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      isStreaming: false,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    // Create assistant message placeholder
    const assistantMessageId = crypto.randomUUID();
    currentMessageIdRef.current = assistantMessageId;
    
    const assistantMessage: StreamingMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, assistantMessage]);

    // Start streaming
    setIsStreaming(true);
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/phoenix/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          contextId
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let metadata: Partial<StreamingMessage> = {};

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'token') {
                accumulatedContent += parsed.content;
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId
                    ? { ...msg, content: accumulatedContent }
                    : msg
                ));
              } else if (parsed.type === 'metadata') {
                metadata = {
                  confidence: parsed.confidence,
                  hypotheses: parsed.hypotheses,
                  tormentScore: parsed.tormentScore,
                  tormentChange: parsed.tormentChange
                };
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      // Finalize message
      const finalMessage: StreamingMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: accumulatedContent,
        isStreaming: false,
        ...metadata,
        timestamp: new Date()
      };

      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId ? finalMessage : msg
      ));

      onComplete?.(finalMessage);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Stream was cancelled
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId
            ? { ...msg, isStreaming: false, content: msg.content + ' [Annulé]' }
            : msg
        ));
      } else {
        onError?.(error as Error);
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId
            ? { ...msg, isStreaming: false, content: 'Erreur lors de la génération de la réponse.' }
            : msg
        ));
      }
    } finally {
      setIsStreaming(false);
      currentMessageIdRef.current = null;
      abortControllerRef.current = null;
    }
  }, [contextId, onComplete, onError]);

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    sendMessage,
    isStreaming,
    cancelStream,
    clearMessages
  };
}

export default useStreamingChat;
