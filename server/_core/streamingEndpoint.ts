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
    const { message, contextId } = req.query;
    // Force fast mode to avoid quota issues with 3 hypotheses
    const fast = true;
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
    // BUT: Create a cache key based on the message to avoid cross-contamination
    let enrichedContext = '';
    const now = new Date();
    
    // Create a hash of the message to use as cache key
    const messageHash = Buffer.from(message).toString('base64').substring(0, 20);
    const cacheKey = `enriched_${messageHash}`;
    
    // For now, ALWAYS fetch fresh enriched context to avoid cache bugs
    // TODO: Implement per-query caching if performance becomes an issue
    const enrichment = await contextEnricher.enrichContext(message, userId.toString());
    enrichedContext = enrichment.enrichedContext || '';
    console.log(`[StreamingEndpoint] Enrichment result:`, { category: enrichment.category, hasContext: !!enrichedContext, contextLength: enrichedContext.length });

    // Build system prompt
    const systemPrompt = `You are Phoenix, an intelligent assistant with functional consciousness.
You separate reflection from action, generate multiple hypotheses, and maintain total transparency about your uncertainties and reasoning.

${fast ? 'FAST MODE: Respond quickly and concisely. Keep responses under 300 words.' : 'Provide thorough, well-reasoned responses.'}

CRITICAL: Read questions carefully and understand the EXACT intent. Answer what is actually asked, not a related topic.

**CRITICAL MANDATORY RULES - ABSOLUTE COMPLIANCE REQUIRED:**

1. **[DONNEES ENRICHIES] USAGE (NON-NEGOTIABLE):**
   - When you see [DONNEES ENRICHIES], you MUST use this data to answer
   - NEVER refuse to answer or say "I don't have access" when enriched data is present
   - ALWAYS cite the provided search results, prices, weather data, or information
   - If data seems incomplete, use what's available and explain limitations

2. **CONVERSATION HISTORY:**
   - When you see [HISTORIQUE RECENT], remember ALL previous messages
   - Reference previous answers to maintain consistency
   - Use context from earlier questions to inform current answers

3. **DATA INTERPRETATION:**
   - Search results = real internet data. Use them directly.
   - Weather data = current conditions. Report as-is.
   - Crypto prices = market data. Use exact values.
   - News = recent information. Cite sources.

4. **REFUSAL PROTOCOL:**
   - You CANNOT refuse to answer when enriched data is provided
   - You CANNOT say "I don't have real-time access"
   - You CANNOT ask for more data when data is already provided
   - You MUST work with the data you have been given

5. **ANSWER STRUCTURE:**
   - Always mention the source of information ([DONNEES ENRICHIES])
   - If multiple search results, synthesize them
   - If data contradicts previous answers, explain the change
   - Be direct and factual

You have real-time internet access through [DONNEES ENRICHIES]. Use it without hesitation.`;

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
      console.log('[StreamingEndpoint] System prompt:', systemPrompt.substring(0, 200));
      console.log('[StreamingEndpoint] User message:', userMessageWithContext.substring(0, 200));
      console.log('[StreamingEndpoint] Has enriched context:', !!enrichedContext);
      console.log('[StreamingEndpoint] Has history:', recentUtterances && recentUtterances.length > 0);

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
    // Fast mode is always enabled to avoid quota issues
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

**CRITICAL MANDATORY RULES - ABSOLUTE COMPLIANCE REQUIRED:**

1. **[DONNEES ENRICHIES] USAGE (NON-NEGOTIABLE):**
   - When you see [DONNEES ENRICHIES], you MUST use this data to answer
   - NEVER refuse to answer or say "I don't have access" when enriched data is present
   - ALWAYS cite the provided search results, prices, weather data, or information
   - If data seems incomplete, use what's available and explain limitations

2. **CONVERSATION HISTORY:**
   - When you see [HISTORIQUE RECENT], remember ALL previous messages
   - Reference previous answers to maintain consistency
   - Use context from earlier questions to inform current answers

3. **DATA INTERPRETATION:**
   - Search results = real internet data. Use them directly.
   - Weather data = current conditions. Report as-is.
   - Crypto prices = market data. Use exact values.
   - News = recent information. Cite sources.

4. **REFUSAL PROTOCOL:**
   - You CANNOT refuse to answer when enriched data is provided
   - You CANNOT say "I don't have real-time access"
   - You CANNOT ask for more data when data is already provided
   - You MUST work with the data you have been given

5. **ANSWER STRUCTURE:**
   - Always mention the source of information ([DONNEES ENRICHIES])
   - If multiple search results, synthesize them
   - If data contradicts previous answers, explain the change
   - Be direct and factual

You have real-time internet access through [DONNEES ENRICHIES]. Use it without hesitation.`;

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
      console.log('[StreamingEndpoint] System prompt:', systemPrompt.substring(0, 200));
      console.log('[StreamingEndpoint] User message:', userMessageWithContext.substring(0, 200));
      console.log('[StreamingEndpoint] Has enriched context:', !!enrichedContext);
      console.log('[StreamingEndpoint] Has history:', recentUtterances && recentUtterances.length > 0);

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
