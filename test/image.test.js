import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateImageRequest, ALLOWED_ASPECT_RATIOS, ALLOWED_STYLES } from '../server/middleware/validateImage.js';
import { generateAiImage } from '../server/services/image.js';
import { ChatHistoryManager } from '../public/js/history.js';

function createMockReq(body = {}) {
  return { body };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

// In-memory mock localStorage for ChatHistoryManager unit test
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe('validateImageRequest Middleware', () => {
  test('passes validation with a valid image prompt', () => {
    const req = createMockReq({
      prompt: 'A futuristic floating city in the clouds at sunset',
      aspectRatio: '16:9',
      style: 'cyberpunk'
    });
    const res = createMockRes();
    let nextCalled = false;

    validateImageRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
    assert.equal(req.cleanImageParams.prompt, 'A futuristic floating city in the clouds at sunset');
    assert.equal(req.cleanImageParams.aspectRatio, '16:9');
    assert.equal(req.cleanImageParams.style, 'cyberpunk');
  });

  test('applies default aspect ratio and style when omitted', () => {
    const req = createMockReq({
      prompt: 'Minimalist neon cat'
    });
    const res = createMockRes();
    let nextCalled = false;

    validateImageRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.cleanImageParams.aspectRatio, '1:1');
    assert.equal(req.cleanImageParams.style, 'cinematic');
  });

  test('rejects missing or non-string prompt with 400', () => {
    const req = createMockReq({});
    const res = createMockRes();
    let nextCalled = false;

    validateImageRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /prompt.*must be a non-empty string/i);
  });

  test('rejects empty or whitespace-only prompt with 400', () => {
    const req = createMockReq({ prompt: '    ' });
    const res = createMockRes();
    let nextCalled = false;

    validateImageRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Prompt cannot be empty/i);
  });

  test('rejects prompt exceeding 1,000 characters with 400', () => {
    const req = createMockReq({ prompt: 'A'.repeat(1001) });
    const res = createMockRes();
    let nextCalled = false;

    validateImageRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /exceeds maximum allowed length/i);
  });

  test('rejects unsupported aspect ratio with 400', () => {
    const req = createMockReq({
      prompt: 'A scenic mountain',
      aspectRatio: '21:9'
    });
    const res = createMockRes();
    let nextCalled = false;

    validateImageRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Invalid "aspectRatio"/i);
  });

  test('accepts all allowed aspect ratios', () => {
    for (const ratio of ALLOWED_ASPECT_RATIOS) {
      const req = createMockReq({
        prompt: 'Forest landscape',
        aspectRatio: ratio
      });
      const res = createMockRes();
      let nextCalled = false;

      validateImageRequest(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true, `Expected ratio ${ratio} to pass validation`);
      assert.equal(res.statusCode, 200);
    }
  });

  test('rejects unsupported art style with 400', () => {
    const req = createMockReq({
      prompt: 'A scenic mountain',
      style: 'surrealist_baroque'
    });
    const res = createMockRes();
    let nextCalled = false;

    validateImageRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Invalid "style"/i);
  });

  test('accepts all allowed art styles', () => {
    for (const style of ALLOWED_STYLES) {
      const req = createMockReq({
        prompt: 'Digital painting of a lion',
        style
      });
      const res = createMockRes();
      let nextCalled = false;

      validateImageRequest(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true, `Expected style ${style} to pass validation`);
      assert.equal(res.statusCode, 200);
    }
  });
});

describe('generateAiImage Service Validation', () => {
  test('rejects empty prompt with an error', async () => {
    await assert.rejects(
      async () => {
        await generateAiImage({ prompt: '' });
      },
      /valid image prompt description is required/i
    );
  });

  test('rejects prompt over 1,000 characters with an error', async () => {
    await assert.rejects(
      async () => {
        await generateAiImage({ prompt: 'B'.repeat(1005) });
      },
      /exceeds maximum length/i
    );
  });
});

describe('ChatHistoryManager Image Persistence', () => {
  test('persists image message metadata (type, imageUrl, aspectRatio, provider)', () => {
    globalThis.localStorage = new MockLocalStorage();

    const manager = new ChatHistoryManager();
    const conv = manager.createConversation('Image Test Chat');

    const imageMsg = manager.addMessage(conv.id, {
      role: 'assistant',
      type: 'image',
      imageUrl: 'data:image/jpeg;base64,mockdata',
      aspectRatio: '16:9',
      provider: 'FLUX.1 Diffusion',
      prompt: 'Sunset over Tokyo skyline'
    });

    assert.equal(imageMsg.type, 'image');
    assert.equal(imageMsg.aspectRatio, '16:9');
    assert.equal(imageMsg.provider, 'FLUX.1 Diffusion');
    assert.equal(imageMsg.imageUrl, 'data:image/jpeg;base64,mockdata');
    assert.equal(imageMsg.prompt, 'Sunset over Tokyo skyline');

    // Reload from storage to verify serialization & deserialization
    const freshManager = new ChatHistoryManager();
    const loadedConv = freshManager.getConversation(conv.id);
    const loadedMsg = loadedConv.messages[0];

    assert.equal(loadedMsg.type, 'image');
    assert.equal(loadedMsg.aspectRatio, '16:9');
    assert.equal(loadedMsg.imageUrl, 'data:image/jpeg;base64,mockdata');
  });
});
