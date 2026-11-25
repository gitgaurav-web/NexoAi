/**
 * Server-Side Validation Middleware for Chat API
 * Validates message structure, roles, content lengths, model names, and turn limits.
 */

const ALLOWED_ROLES = new Set(['user', 'assistant', 'model']);
const MODEL_NAME_REGEX = /^[a-zA-Z0-9.\-_]{2,64}$/;

export function validateChatRequest(req, res, next) {
  const { messages, model, customSystemPrompt, maxTurns } = req.body || {};
  const apiKey = req.headers['x-api-key'] || req.body?.apiKey;

  // 1. Validate messages array
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({
      error: 'Validation Error: "messages" must be a non-empty array.'
    });
  }

  if (messages.length === 0) {
    return res.status(400).json({
      error: 'Validation Error: At least one message is required.'
    });
  }

  if (messages.length > 50) {
    return res.status(400).json({
      error: 'Validation Error: Exceeded maximum allowed messages per request (max 50).'
    });
  }

  let totalContentChars = 0;
  let hasUserMessage = false;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (!msg || typeof msg !== 'object') {
      return res.status(400).json({
        error: `Validation Error: Message at index ${i} must be an object.`
      });
    }

    const role = (msg.role || '').toLowerCase().trim();
    if (!ALLOWED_ROLES.has(role)) {
      return res.status(400).json({
        error: `Validation Error: Message at index ${i} has invalid role "${msg.role}". Allowed roles: "user", "assistant".`
      });
    }

    if (role === 'user') {
      hasUserMessage = true;
    }

    if (typeof msg.content !== 'string') {
      return res.status(400).json({
        error: `Validation Error: Message at index ${i} content must be a string.`
      });
    }

    const trimmed = msg.content.trim();
    if (trimmed.length === 0) {
      return res.status(400).json({
        error: `Validation Error: Message at index ${i} cannot be empty.`
      });
    }

    if (trimmed.length > 30000) {
      return res.status(400).json({
        error: `Validation Error: Message at index ${i} exceeds maximum length of 30,000 characters.`
      });
    }

    totalContentChars += trimmed.length;
  }

  if (!hasUserMessage) {
    return res.status(400).json({
      error: 'Validation Error: Conversation must contain at least one user message.'
    });
  }

  if (totalContentChars > 120000) {
    return res.status(400).json({
      error: 'Validation Error: Total conversation content exceeds 120,000 characters.'
    });
  }

  // 2. Validate model identifier if provided
  if (model !== undefined && model !== null) {
    if (typeof model !== 'string' || !MODEL_NAME_REGEX.test(model.trim())) {
      return res.status(400).json({
        error: 'Validation Error: Invalid "model" format. Must contain only alphanumeric characters, dots, and hyphens (max 64 chars).'
      });
    }
  }

  // 3. Validate maxTurns if provided
  if (maxTurns !== undefined && maxTurns !== null) {
    const turns = Number(maxTurns);
    if (!Number.isInteger(turns) || turns < 1 || turns > 100) {
      return res.status(400).json({
        error: 'Validation Error: "maxTurns" must be an integer between 1 and 100.'
      });
    }
  }

  // 4. Validate customSystemPrompt if provided
  if (customSystemPrompt !== undefined && customSystemPrompt !== null) {
    if (typeof customSystemPrompt !== 'string' || customSystemPrompt.length > 3000) {
      return res.status(400).json({
        error: 'Validation Error: "customSystemPrompt" must be a string under 3,000 characters.'
      });
    }
  }

  // 5. Validate client API key format if supplied
  if (apiKey !== undefined && apiKey !== null && apiKey !== '') {
    if (typeof apiKey !== 'string') {
      return res.status(400).json({
        error: 'Validation Error: Client API key must be a string.'
      });
    }

    const trimmedKey = apiKey.trim();
    if (trimmedKey.length < 10 || trimmedKey.length > 512 || /[\r\n\t\0\x08]/.test(trimmedKey)) {
      return res.status(400).json({
        error: 'Validation Error: Client API key must be between 10 and 512 characters and cannot contain control characters or newlines.'
      });
    }
  }

  next();
}
