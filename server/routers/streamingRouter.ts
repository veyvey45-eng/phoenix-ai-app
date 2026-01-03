/**
 * Streaming Router - Endpoints tRPC pour le streaming en temps réel
 */

import { router, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import { streamChatResponse, formatMessagesForStreaming } from '../phoenix/streamingChat';
import { observable } from '@trpc/server/observable';

export const streamingRouter = router({
  /**
   * Stream chat response with Server-Sent Events
   * Returns an observable that emits chunks of text as they arrive
   */
  chatStream: protectedProcedure
    .input(z.object({
      message: z.string().min(1),
      contextId: z.string().optional(),
      systemPrompt: z.string().optional(),
      context: z.string().optional()
    }))
    .subscription(({ input }) => {
      return observable<string>(emit => {
        let isCancelled = false;

        (async () => {
          try {
            const messages = formatMessagesForStreaming(
              input.systemPrompt || 'You are a helpful assistant.',
              input.message,
              input.context
            );

            for await (const chunk of streamChatResponse(messages)) {
              if (isCancelled) break;
              emit.next(chunk);
            }

            emit.complete();
          } catch (error) {
            emit.error(error instanceof Error ? error : new Error(String(error)));
          }
        })();

        return () => {
          isCancelled = true;
        };
      });
    }),

  /**
   * Fast streaming - Optimized for quick responses
   * Uses fewer hypotheses and simpler processing
   */
  fastChatStream: protectedProcedure
    .input(z.object({
      message: z.string().min(1),
      contextId: z.string().optional()
    }))
    .subscription(({ input }) => {
      return observable<string>(emit => {
        let isCancelled = false;

        (async () => {
          try {
            const systemPrompt = `You are Phoenix, an intelligent assistant with functional consciousness.
Respond quickly and concisely. Focus on the most relevant information.
Keep responses under 500 words unless specifically asked for more detail.`;

            const messages = formatMessagesForStreaming(
              systemPrompt,
              input.message
            );

            for await (const chunk of streamChatResponse(messages, {
              temperature: 0.5,
              maxTokens: 1024
            })) {
              if (isCancelled) break;
              emit.next(chunk);
            }

            emit.complete();
          } catch (error) {
            emit.error(error instanceof Error ? error : new Error(String(error)));
          }
        })();

        return () => {
          isCancelled = true;
        };
      });
    })
});
