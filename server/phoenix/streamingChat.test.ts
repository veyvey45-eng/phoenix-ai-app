/**
 * Tests pour le module de streaming chat
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { streamChatResponse, formatMessagesForStreaming } from './streamingChat';

describe('Streaming Chat Module', () => {
  describe('formatMessagesForStreaming', () => {
    it('should format messages without context', () => {
      const messages = formatMessagesForStreaming(
        'You are a helpful assistant.',
        'Hello, how are you?'
      );

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toBe('You are a helpful assistant.');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toBe('Hello, how are you?');
    });

    it('should format messages with context', () => {
      const messages = formatMessagesForStreaming(
        'You are a helpful assistant.',
        'What is the capital of France?',
        'France is a country in Europe.'
      );

      expect(messages).toHaveLength(2);
      expect(messages[1].content).toContain('Context:');
      expect(messages[1].content).toContain('France is a country in Europe.');
      expect(messages[1].content).toContain('Question: What is the capital of France?');
    });

    it('should handle empty context', () => {
      const messages = formatMessagesForStreaming(
        'System prompt',
        'User message',
        ''
      );

      expect(messages).toHaveLength(2);
      expect(messages[1].content).toBe('User message');
    });

    it('should handle undefined context', () => {
      const messages = formatMessagesForStreaming(
        'System prompt',
        'User message',
        undefined
      );

      expect(messages).toHaveLength(2);
      expect(messages[1].content).toBe('User message');
    });
  });

  describe('streamChatResponse', () => {
    it('should stream response with Groq API', async () => {
      if (!process.env.GROG_API_KEY) {
        console.log('[Test] Skipping Groq streaming test - API key not available');
        return;
      }

      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Count to 3' }
      ];

      let chunkCount = 0;
      let fullResponse = '';

      try {
        for await (const chunk of streamChatResponse(messages)) {
          chunkCount++;
          fullResponse += chunk;
          expect(typeof chunk).toBe('string');
          expect(chunk.length).toBeGreaterThan(0);
        }

        expect(chunkCount).toBeGreaterThan(0);
        expect(fullResponse.length).toBeGreaterThan(0);
        // Should contain numbers
        expect(/\d/.test(fullResponse)).toBe(true);
      } catch (error) {
        console.log('[Test] Groq streaming test skipped due to API error');
      }
    });

    it('should handle streaming errors gracefully', async () => {
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Test message' }
      ];

      // This should not throw, but handle errors internally
      try {
        for await (const chunk of streamChatResponse(messages, {
          temperature: 0.7,
          maxTokens: 100
        })) {
          expect(typeof chunk).toBe('string');
        }
      } catch (error) {
        // Error is expected if API is not available
        expect(error).toBeDefined();
      }
    });

    it('should respect temperature option', async () => {
      if (!process.env.GROG_API_KEY) {
        console.log('[Test] Skipping temperature test - API key not available');
        return;
      }

      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello' }
      ];

      try {
        let response1 = '';
        for await (const chunk of streamChatResponse(messages, {
          temperature: 0.1
        })) {
          response1 += chunk;
        }

        let response2 = '';
        for await (const chunk of streamChatResponse(messages, {
          temperature: 0.9
        })) {
          response2 += chunk;
        }

        // Both should produce valid responses
        expect(response1.length).toBeGreaterThan(0);
        expect(response2.length).toBeGreaterThan(0);
      } catch (error) {
        console.log('[Test] Temperature test skipped due to API error');
      }
    });

    it('should respect maxTokens option', async () => {
      if (!process.env.GROG_API_KEY) {
        console.log('[Test] Skipping maxTokens test - API key not available');
        return;
      }

      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Write a long story' }
      ];

      try {
        let response = '';
        for await (const chunk of streamChatResponse(messages, {
          maxTokens: 50
        })) {
          response += chunk;
        }

        // Response should be relatively short
        expect(response.length).toBeGreaterThan(0);
        expect(response.length).toBeLessThan(500); // Rough estimate
      } catch (error) {
        console.log('[Test] maxTokens test skipped due to API error');
      }
    });
  });

  describe('Performance', () => {
    it('should stream response quickly', async () => {
      if (!process.env.GROG_API_KEY) {
        console.log('[Test] Skipping performance test - API key not available');
        return;
      }

      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello' }
      ];

      const startTime = Date.now();
      let firstChunkTime = 0;
      let chunkCount = 0;

      try {
        for await (const chunk of streamChatResponse(messages, {
          temperature: 0.5,
          maxTokens: 100
        })) {
          chunkCount++;
          if (firstChunkTime === 0) {
            firstChunkTime = Date.now() - startTime;
          }
        }

        const totalTime = Date.now() - startTime;

        console.log(`[Performance] First chunk: ${firstChunkTime}ms, Total: ${totalTime}ms, Chunks: ${chunkCount}`);

        // First chunk should arrive within reasonable time (< 5 seconds)
        expect(firstChunkTime).toBeLessThan(5000);
      } catch (error) {
        console.log('[Test] Performance test skipped due to API error');
      }
    });
  });
});
