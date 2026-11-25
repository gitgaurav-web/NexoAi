import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateChatRequest } from '../server/middleware/validateChat.js';

function createMockReq(body = {}, headers = {}) {
  return {
    body,
    headers
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    }
  };
  return res;
}

describe('validateChatRequest Middleware', () => {
  test('passes validation with a valid user message', () => {
    const req = createMockReq({
      messages: [{ role: 'user', content: 'Hello NexoAI' }]
    });
    const res = createMockRes();
    let nextCalled = false;

    validateChatRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  });

  test('passes validation with multi-turn conversation and options', () => {
    const req = createMockReq({
      messages: [
        { role: 'user', content: 'What is Node.js?' },
        { role: 'assistant', content: 'Node.js is a runtime.' },
        { role: 'user', content: 'Tell me more.' }
      ],
      model: 'gemini-2.5-flash',
      customSystemPrompt: 'Be concise.',
      maxTurns: 20
    });
    const res = createMockRes();
    let nextCalled = false;

    validateChatRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });

  test('rejects missing or non-array messages with 400', () => {
    const req = createMockReq({});
    const res = createMockRes();
    let nextCalled = false;

    validateChatRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /must be a non-empty array/);
  });

  test('rejects empty messages array with 400', () => {
    const req = createMockReq({ messages: [] });
    const res = createMockRes();
    let nextCalled = false;

    validateChatRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /At least one message is required/);
  });

  test('rejects requests with more than 50 messages with 400', () => {
    const messages = Array.from({ length: 51 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`
    }));
    const req = createMockReq({ messages });
    const res = createMockRes();
    let nextCalled = false;

    validateChatRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Exceeded maximum allowed messages/);
  });

  test('rejects invalid message role (e.g. system or admin) with 400', () => {
    const req = createMockReq({
      messages: [
        { role: 'system', content: 'You are an AI' },
        { role: 'user', content: 'Hello' }
      ]
    });
    const res = createMockRes();
    let nextCalled = false;

    validateChatRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /invalid role/);
  });

  test('rejects conversation without any user message with 400', () => {
    const req = createMockReq({
      messages: [{ role: 'assistant', content: 'Hello user' }]
    });
    const res = createMockRes();
    let nextCalled = false;

    validateChatRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /must contain at least one user message/);
  });

  test('rejects messages with empty content with 400', () => {
    const req = createMockReq({
      messages: [{ role: 'user', content: '   ' }]
    });
    const res = createMockRes();
    let nextCalled = false;

    validateChatRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /cannot be empty/);
  });

  test('rejects message content exceeding 30,000 characters with 400', () => {
    const longText = 'a'.repeat(30001);
    const req = createMockReq({
      messages: [{ role: 'user', content: longText }]
    });
    const res = createMockRes();
    let nextCalled = false;

    validateChatRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /exceeds maximum length of 30,000 characters/);
  });

  test('rejects invalid model name format with 400', () => {
    const req = createMockReq({
      messages: [{ role: 'user', content: 'Hi' }],
      model: 'invalid model; rm -rf /'
    });
    const res = createMockRes();
    let nextCalled = false;

    validateChatRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Invalid "model" format/);
  });

  test('rejects invalid maxTurns (out of range or not an integer) with 400', () => {
    const req = createMockReq({
      messages: [{ role: 'user', content: 'Hi' }],
      maxTurns: 999
    });
    const res = createMockRes();
    let nextCalled = false;

    validateChatRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /"maxTurns" must be an integer between 1 and 100/);
  });

  test('rejects customSystemPrompt longer than 3000 characters with 400', () => {
    const req = createMockReq({
      messages: [{ role: 'user', content: 'Hi' }],
      customSystemPrompt: 'x'.repeat(3001)
    });
    const res = createMockRes();
    let nextCalled = false;

    validateChatRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /"customSystemPrompt" must be a string under 3,000 characters/);
  });

  test('accepts valid provider API keys including Google AI Studio formats', () => {
    const req = createMockReq({
      messages: [{ role: 'user', content: 'Hi' }],
      apiKey: 'AIzaSyMockKeyForTestingPurposesOnly_123456789'
    });
    const res = createMockRes();
    let nextCalled = false;

    validateChatRequest(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  });

  test('rejects API keys that are too short (<10 chars) or contain newlines with 400', () => {
    const reqShort = createMockReq({
      messages: [{ role: 'user', content: 'Hi' }],
      apiKey: 'short'
    });
    const resShort = createMockRes();
    let nextShort = false;
    validateChatRequest(reqShort, resShort, () => { nextShort = true; });
    assert.equal(nextShort, false);
    assert.equal(resShort.statusCode, 400);

    const reqNewline = createMockReq({
      messages: [{ role: 'user', content: 'Hi' }],
      apiKey: 'AIzaSyFakeKey\r\nInjectedHeader'
    });
    const resNewline = createMockRes();
    let nextNewline = false;
    validateChatRequest(reqNewline, resNewline, () => { nextNewline = true; });
    assert.equal(nextNewline, false);
    assert.equal(resNewline.statusCode, 400);
  });
});
