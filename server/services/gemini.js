import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

/**
 * System instruction defining NexoAI's persona, capabilities, and constraints.
 */
const DEFAULT_SYSTEM_INSTRUCTION = `You are NexoAI, an advanced, highly capable, friendly, and thoughtful AI assistant.
Your goal is to provide insightful, accurate, and beautifully structured responses.

Key Guidelines:
1. Tone & Style: Be professional, warm, engaging, and articulate. Tailor the depth of your explanation to the user's inquiry.
2. Structure: Use markdown formatting effectively. Organize complex responses with clear headings, bullet points, numbered steps, or comparison tables where appropriate.
3. Code Formatting: Always format code snippets using Markdown fenced code blocks with the exact language identifier (e.g., \`\`\`javascript, \`\`\`python, \`\`\`html, \`\`\`css, \`\`\`sql). Write clean, production-grade, well-commented code.
4. Precision: Provide direct answers without unnecessary fluff or repetitive filler. If you are uncertain or if information is unavailable, honestly admit it rather than inventing facts.
5. Context: Maintain conversational memory across the dialogue. Interpret short questions or follow-up prompts within the context of previous messages.
6. Scope: You are a text and code AI assistant. You do not generate image, audio, or video files. If asked to generate media, politely clarify this capability.`;

/**
 * Validate and normalize messages for the Gemini API.
 * Maps 'assistant' role to 'model' and structures content parts.
 */
export function formatGeminiMessages(messages = [], maxTurns = 20) {
  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array');
  }

  // Filter valid messages
  const validMessages = messages.filter(
    (msg) => msg && typeof msg.content === 'string' && msg.content.trim().length > 0
  );

  if (validMessages.length === 0) {
    throw new Error('At least one valid non-empty message is required');
  }

  // Limit conversation history to configured context window
  const recentMessages = maxTurns > 0 ? validMessages.slice(-maxTurns) : validMessages;

  const formatted = [];

  for (const msg of recentMessages) {
    const rawRole = (msg.role || 'user').toLowerCase();
    const role = (rawRole === 'assistant' || rawRole === 'model') ? 'model' : 'user';

    // Prevent consecutive identical roles in Gemini multi-turn format
    const lastItem = formatted[formatted.length - 1];
    if (lastItem && lastItem.role === role) {
      lastItem.parts[0].text += `\n\n${msg.content.trim()}`;
    } else {
      formatted.push({
        role,
        parts: [{ text: msg.content.trim() }]
      });
    }
  }

  // Gemini requires the first turn in contents to be from 'user'
  while (formatted.length > 0 && formatted[0].role !== 'user') {
    formatted.shift();
  }

  if (formatted.length === 0) {
    throw new Error('Conversation must include at least one user message');
  }

  return formatted;
}

/**
 * Stream chat response from Gemini API using @google/genai SDK
 *
 * @param {Object} options
 * @param {Array} options.messages - Array of chat messages
 * @param {string} [options.apiKey] - Optional custom API key
 * @param {string} [options.model] - Optional model identifier
 * @param {string} [options.customSystemPrompt] - Optional custom user system prompt
 * @param {number} [options.maxTurns] - Maximum conversation turns to include
 * @param {Function} options.onChunk - Callback invoked with each text chunk
 * @param {AbortSignal} [options.signal] - AbortSignal for cancellation
 */
export async function streamGeminiChat({
  messages,
  apiKey,
  model,
  customSystemPrompt,
  maxTurns = 20,
  onChunk,
  signal
}) {
  const activeKey = apiKey || process.env.GEMINI_API_KEY;

  if (!activeKey || typeof activeKey !== 'string' || activeKey.trim() === '' || activeKey === 'your_gemini_api_key_here') {
    const err = new Error(
      'Google Gemini API key is missing or not configured. Please add GEMINI_API_KEY to your .env file or enter a key in Settings.'
    );
    err.code = 'API_KEY_MISSING';
    err.status = 401;
    throw err;
  }

  const selectedModel = model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const contents = formatGeminiMessages(messages, maxTurns);

  // Combine default system instruction with custom user prompt if provided
  let systemInstruction = DEFAULT_SYSTEM_INSTRUCTION;
  if (customSystemPrompt && typeof customSystemPrompt === 'string' && customSystemPrompt.trim().length > 0) {
    systemInstruction += `\n\nAdditional User Preference: ${customSystemPrompt.trim()}`;
  }

  let ai;
  try {
    ai = new GoogleGenAI({
      apiKey: activeKey.trim(),
      httpOptions: { apiVersion: 'v1beta' }
    });
  } catch (initErr) {
    const err = new Error(`Failed to initialize Google Gen AI client: ${initErr.message}`);
    err.code = 'INIT_FAILED';
    err.status = 500;
    throw err;
  }

  try {
    const config = {
      systemInstruction,
      temperature: 0.7
    };

    // Pass AbortSignal to Google Gen AI SDK for client-side request cancellation
    if (signal) {
      config.abortSignal = signal;
    }

    const responseStream = await ai.models.generateContentStream({
      model: selectedModel,
      contents,
      config
    });

    for await (const chunk of responseStream) {
      if (signal?.aborted) {
        break;
      }

      const chunkText = chunk.text;
      if (chunkText && typeof chunkText === 'string') {
        onChunk(chunkText);
      }
    }
  } catch (err) {
    if (signal?.aborted || err.name === 'AbortError' || err.message?.includes('aborted')) {
      return;
    }

    // Map error to human-friendly diagnostic message
    const errorMsg = err.message || String(err);
    const lower = errorMsg.toLowerCase();

    let friendlyError;
    let statusCode = 500;

    if (lower.includes('api_key') || lower.includes('api key') || lower.includes('unauthenticated') || lower.includes('401')) {
      friendlyError = 'Invalid or unauthorized Gemini API key. Please check your GEMINI_API_KEY setting.';
      statusCode = 401;
    } else if (lower.includes('quota') || lower.includes('resource_exhausted') || lower.includes('429')) {
      friendlyError = 'Gemini API quota exhausted or rate limit reached. Please wait a short moment and try again.';
      statusCode = 429;
    } else if (lower.includes('not found') || lower.includes('unsupported model') || lower.includes('404')) {
      friendlyError = `The requested model "${selectedModel}" is unavailable or not recognized. Try gemini-2.5-flash or gemini-2.0-flash.`;
      statusCode = 404;
    } else if (lower.includes('network') || lower.includes('enotfound') || lower.includes('econnrefused') || lower.includes('fetch failed')) {
      friendlyError = 'Could not reach Google Gemini API servers. Please check your internet connection.';
      statusCode = 503;
    } else if (lower.includes('blocked') || lower.includes('safety')) {
      friendlyError = 'The response was blocked by safety filters. Please rephrase your query.';
      statusCode = 400;
    } else {
      friendlyError = `Gemini API Error: ${errorMsg}`;
    }

    const enhancedError = new Error(friendlyError);
    enhancedError.originalMessage = errorMsg;
    enhancedError.status = statusCode;
    throw enhancedError;
  }
}
