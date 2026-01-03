/**
 * Streaming Endpoint - Express middleware pour Server-Sent Events
 */

import { Request, Response } from 'express';
import { streamChatResponse, formatMessagesForStreaming } from '../phoenix/streamingChat';
import { phoenix, PhoenixContext } from '../phoenix/core';
import { contextEnricher } from '../phoenix/contextEnricher';
import { getMemoriesByUser, getRecentUtterances, getActiveIssues, getActiveCriteria, getOrCreatePhoenixState, getDb } from '../db';
import { getFileProcessor } from '../phoenix/fileProcessor';
import { phoenixState } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Stream chat response using Server-Sent Events
 */
export async function streamChatEndpoint(req: Request, res: Response) {
  try {
    const { message, contextId, fast } = req.query;
    const userId = (req as any).user?.id || 1; // Default to user ID 1 for anonymous users

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Build Phoenix context for enrichment
    const memories = await getMemoriesByUser(userId, fast ? 10 : 50);
    const recentUtterances = await getRecentUtterances(userId, 5);
    const activeIssues = await getActiveIssues(userId);
    const criteriaList = await getActiveCriteria();
    const state = await getOrCreatePhoenixState(userId);

    const phoenixContext: PhoenixContext = {
      userId,
      contextId: (contextId as string) || '',
      memories: memories.map(m => ({
        id: m.id,
        content: m.content,
        salience: m.salience ?? 0.5,
        memoryType: m.memoryType
      })),
      recentUtterances: recentUtterances.map(u => ({
        role: u.role,
        content: u.content,
        confidence: u.confidence ?? 1.0
      })),
      activeIssues: activeIssues.map(i => ({
        id: i.id,
        type: i.type,
        severity: i.severity,
        evidence: i.evidence
      })),
      tormentScore: state.tormentScore,
      criteria: criteriaList.map(c => ({
        name: c.name,
        level: c.level,
        rule: c.rule,
        weight: c.weight
      }))
    };

    // Get cached enriched context if it's recent (less than 5 minutes old)
    let enrichedContext = '';
    const now = new Date();
    if (state.lastEnrichedAt && (now.getTime() - state.lastEnrichedAt.getTime()) < 5 * 60 * 1000 && state.enrichedContext) {
      enrichedContext = state.enrichedContext;
      console.log(`[StreamingEndpoint] Using cached enriched context from ${state.lastEnrichedAt}`);
    } else {
      // Fetch fresh enriched context
      const enrichment = await contextEnricher.enrichContext(message, userId.toString());
      enrichedContext = enrichment.enrichedContext || '';
      console.log(`[StreamingEndpoint] Enrichment result:`, { category: enrichment.category, hasContext: !!enrichedContext, contextLength: enrichedContext.length });
      
      // Save to database for future use
      if (enrichedContext) {
        try {
          const db = await getDb();
          if (db) {
            await db.update(phoenixState).set({
              enrichedContext,
              lastEnrichedAt: now,
            }).where(eq(phoenixState.userId, userId));
            console.log(`[StreamingEndpoint] Saved enriched context to database`);
          }
        } catch (err) {
          console.error('[StreamingEndpoint] Error saving enriched context:', err);
        }
      }
    }

    // Build system prompt
    const systemPrompt = `You are Phoenix, an intelligent assistant with functional consciousness.
You separate reflection from action, generate multiple hypotheses, and maintain total transparency about your uncertainties and reasoning.

${fast ? 'FAST MODE: Respond quickly and concisely. Keep responses under 300 words.' : 'Provide thorough, well-reasoned responses.'}

CRITICAL: Read questions carefully and understand the EXACT intent. Answer what is actually asked, not a related topic.

IMPORTANT: 
1. When you see [DONNEES ENRICHIES], use those data. Never claim you lack access when data is provided.
2. When you see [HISTORIQUE RECENT], remember and reference the previous conversation.
3. Be consistent with previous answers in the same conversation.
4. If a question seems ambiguous, clarify what you understood before answering.`;

    // Stream the response
    try {
      // Build message with conversation history
      let userMessageWithContext = message;
      
      // Add recent utterances if available
      if (recentUtterances && recentUtterances.length > 0) {
        const history = recentUtterances
          .map(u => `${u.role === 'user' ? 'Toi' : 'Phoenix'}: ${u.content}`)
          .join('\n');
        userMessageWithContext = `[HISTORIQUE RECENT]\n${history}\n\n[QUESTION ACTUELLE]\n${message}`;
      }
      
      // Add enriched context if available
      if (enrichedContext) {
        userMessageWithContext = `[DONNEES ENRICHIES]\n${enrichedContext}\n\n${userMessageWithContext}`;
      }
      
      const messages = formatMessagesForStreaming(systemPrompt, userMessageWithContext);
      console.log('[StreamingEndpoint] Messages sent to Groq:', JSON.stringify(messages, null, 2));

      for await (const chunk of streamChatResponse(messages, {
        temperature: fast ? 0.5 : 0.7,
        maxTokens: fast ? 1024 : 2048
      })) {
        // Send chunk as SSE
        res.write(`data: ${JSON.stringify({ type: 'token', content: chunk })}\n\n`);
      }

      // Send completion marker
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      console.error('[StreamingEndpoint] Error during streaming:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Streaming error' })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error('[StreamingEndpoint] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Fast streaming endpoint (optimized for quick responses)
 */
export async function fastStreamChatEndpoint(req: Request, res: Response) {
  try {
    const { message, contextId } = req.query;
    const userId = (req as any).user?.id || 1; // Default to user ID 1 for anonymous users

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Enrich context with internet data if needed
    const enrichment = await contextEnricher.enrichContext(message, userId.toString());
    const enrichedContext = enrichment.enrichedContext || '';
    console.log(`[FastStreamEndpoint] Enrichment result:`, { category: enrichment.category, hasContext: !!enrichedContext, contextLength: enrichedContext.length });

    // Fast mode: minimal context
    const recentUtterances = await getRecentUtterances(userId, 3);

    const systemPrompt = `You are Phoenix, a quick and helpful assistant.
Respond concisely and directly. Keep responses under 200 words.
Focus on the most relevant information.

CRITICAL: Read questions carefully and understand the EXACT intent. Answer what is actually asked, not a related topic.

IMPORTANT: 
1. When you see [DONNEES ENRICHIES], use those data. Never claim you lack access when data is provided.
2. When you see [HISTORIQUE RECENT], remember and reference the previous conversation.
3. Be consistent with previous answers in the same conversation.
4. If a question seems ambiguous, clarify what you understood before answering.`;

    // Stream the response
    try {
      // Build message with conversation history
      let userMessageWithContext = message;
      
      // Add recent utterances if available
      if (recentUtterances && recentUtterances.length > 0) {
        const history = recentUtterances
          .map(u => `${u.role === 'user' ? 'Toi' : 'Phoenix'}: ${u.content}`)
          .join('\n');
        userMessageWithContext = `[HISTORIQUE RECENT]\n${history}\n\n[QUESTION ACTUELLE]\n${message}`;
      }
      
      // Add enriched context if available
      if (enrichedContext) {
        userMessageWithContext = `[DONNEES ENRICHIES]\n${enrichedContext}\n\n${userMessageWithContext}`;
      }
      
      const messages = formatMessagesForStreaming(systemPrompt, userMessageWithContext);
      console.log('[StreamingEndpoint] Messages sent to Groq:', JSON.stringify(messages, null, 2));

      for await (const chunk of streamChatResponse(messages, {
        temperature: 0.5,
        maxTokens: 512
      })) {
        // Send chunk as SSE
        res.write(`data: ${JSON.stringify({ type: 'token', content: chunk })}\n\n`);
      }

      // Send completion marker
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      console.error('[FastStreamingEndpoint] Error during streaming:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Streaming error' })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error('[FastStreamingEndpoint] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
