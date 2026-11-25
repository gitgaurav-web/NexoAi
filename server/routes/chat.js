import express from 'express';
import { streamGeminiChat } from '../services/gemini.js';
import { validateChatRequest } from '../middleware/validateChat.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Rate limiter applied specifically to AI generation requests (60 per minute per IP)
// This ensures GET /status checks do not burn the chat rate limit quota.
const chatRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60
});

/**
 * GET /api/chat/status
 * Returns API configuration status without exposing sensitive keys.
 */
router.get('/status', (req, res) => {
  const envKey = process.env.GEMINI_API_KEY;
  const isKeyConfigured = Boolean(
    envKey &&
    envKey.trim() !== '' &&
    envKey !== 'your_gemini_api_key_here' &&
    envKey.length > 10
  );

  res.json({
    status: 'online',
    defaultModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    hasApiKey: isKeyConfigured
  });
});

/**
 * POST /api/chat
 * Streams real-time AI responses using Server-Sent Events (SSE).
 */
router.post('/', chatRateLimiter, validateChatRequest, async (req, res) => {
  const { messages, model, customSystemPrompt, maxTurns } = req.body;
  const apiKey = req.headers['x-api-key'] || req.body.apiKey;

  // Set up Server-Sent Events (SSE) response headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const abortController = new AbortController();

  // Handle client disconnection (user clicked stop or closed connection)
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  try {
    await streamGeminiChat({
      messages,
      apiKey,
      model,
      customSystemPrompt,
      maxTurns: typeof maxTurns === 'number' ? maxTurns : 20,
      signal: abortController.signal,
      onChunk: (chunkText) => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        }
      }
    });

    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
  } catch (error) {
    if (!res.writableEnded) {
      const statusCode = error.status || 500;
      const errorMessage = error.message || 'An unexpected error occurred during generation.';

      // Send error event through SSE
      res.write(
        `data: ${JSON.stringify({
          error: errorMessage,
          statusCode,
          done: true
        })}\n\n`
      );
      res.end();
    }
  }
});

export default router;
