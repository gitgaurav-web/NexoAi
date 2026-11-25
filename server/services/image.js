/**
 * NexoAI - AI Image Generation Service
 * High-performance, high-resolution AI image synthesis using FLUX.1 and modern diffusion models.
 */

export async function generateAiImage({
  prompt,
  aspectRatio = '1:1',
  style = 'cinematic'
}) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('A valid image prompt description is required.');
  }

  const cleanPrompt = prompt.trim();
  if (cleanPrompt.length > 1000) {
    throw new Error('Image prompt exceeds maximum length of 1,000 characters.');
  }

  // Dimension mapping based on standard aspect ratios (optimized for FLUX.1 diffusion)
  const dimensionMap = {
    '1:1': { width: 512, height: 512 },
    '16:9': { width: 768, height: 432 },
    '9:16': { width: 432, height: 768 },
    '4:3': { width: 640, height: 480 },
    '3:4': { width: 480, height: 640 }
  };

  const dimensions = dimensionMap[aspectRatio] || dimensionMap['1:1'];

  // Style enhancements
  const styleKeywords = {
    cinematic: 'cinematic lighting, 8k uhd, photorealistic, atmospheric, masterpiece',
    photorealistic: 'hyperrealistic photograph, 35mm lens, f/1.8, studio lighting, detailed texture',
    anime: 'vibrant anime aesthetic, Studio Ghibli inspired, high quality digital illustration, clean line art',
    digital_art: 'stunning concept art, trending on ArtStation, dynamic composition, vivid colors',
    cyberpunk: 'cyberpunk aesthetic, neon lighting, futuristic city, rainy reflections, synthwave glow',
    minimalist: 'minimalist clean vector design, flat illustration, elegant composition, modern graphics'
  };

  let enhancedPrompt = cleanPrompt;
  const enhancement = styleKeywords[style] || styleKeywords.cinematic;
  if (!cleanPrompt.toLowerCase().includes(style)) {
    enhancedPrompt = `${cleanPrompt}, ${enhancement}`;
  }

  const encodedPrompt = encodeURIComponent(enhancedPrompt);
  const seed = Math.floor(Math.random() * 9999999);
  const targetUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${dimensions.width}&height=${dimensions.height}&model=flux&nologo=true&seed=${seed}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 50000); // 50s timeout

  try {
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'image/jpeg, image/png, image/*',
        'User-Agent': 'NexoAI-Chatbot/1.0'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Generation server responded with status ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('image')) {
      throw new Error('Server returned non-image data.');
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 2000) {
      throw new Error('Generated image file is incomplete.');
    }

    const base64Data = buffer.toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64Data}`;

    return {
      success: true,
      imageUrl,
      prompt: cleanPrompt,
      enhancedPrompt,
      aspectRatio,
      dimensions: `${dimensions.width}x${dimensions.height}`,
      provider: 'FLUX.1 Diffusion',
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Image generation timed out. Please try again with a simpler prompt.');
    }
    throw new Error(`Image generation failed: ${err.message}`);
  }
}
