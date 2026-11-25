import express from 'express';
import { generateAiImage } from '../services/image.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { validateImageRequest } from '../middleware/validateImage.js';

const router = express.Router();

// Rate limit: 20 image requests per minute per IP
const imageRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20
});

/**
 * POST /api/image/generate
 * Synthesizes high-resolution images from textual descriptions.
 */
router.post('/generate', imageRateLimiter, validateImageRequest, async (req, res) => {
  try {
    const result = await generateAiImage(req.cleanImageParams);
    res.json(result);
  } catch (error) {
    console.error('Image Generation Error:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to generate image.'
    });
  }
});

export default router;
