/**
 * NexoAI - Image Request Validation Middleware
 */

export const ALLOWED_ASPECT_RATIOS = new Set(['1:1', '16:9', '9:16', '4:3', '3:4']);
export const ALLOWED_STYLES = new Set(['cinematic', 'photorealistic', 'anime', 'digital_art', 'cyberpunk', 'minimalist']);

export function validateImageRequest(req, res, next) {
  const { prompt, aspectRatio = '1:1', style = 'cinematic' } = req.body || {};

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({
      error: 'Validation Error: "prompt" must be a non-empty string.'
    });
  }

  const cleanPrompt = prompt.trim();
  if (cleanPrompt.length === 0) {
    return res.status(400).json({
      error: 'Validation Error: Prompt cannot be empty.'
    });
  }

  if (cleanPrompt.length > 1000) {
    return res.status(400).json({
      error: 'Validation Error: Prompt exceeds maximum allowed length of 1,000 characters.'
    });
  }

  if (aspectRatio && !ALLOWED_ASPECT_RATIOS.has(aspectRatio)) {
    return res.status(400).json({
      error: 'Validation Error: Invalid "aspectRatio". Allowed values: "1:1", "16:9", "9:16", "4:3", "3:4".'
    });
  }

  if (style && !ALLOWED_STYLES.has(style)) {
    return res.status(400).json({
      error: 'Validation Error: Invalid "style". Allowed values: "cinematic", "photorealistic", "anime", "digital_art", "cyberpunk", "minimalist".'
    });
  }

  req.cleanImageParams = {
    prompt: cleanPrompt,
    aspectRatio,
    style
  };

  next();
}
