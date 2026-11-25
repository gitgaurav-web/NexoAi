import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure SSE parser simulation that models the exact logic in ChatController.sendMessage
 */
async function processSseStream(mockChunks, abortSignal) {
  let buffer = '';
  let receivedDone = false;
  const tokens = [];

  const decoder = new TextDecoder('utf-8');

  for (const chunk of mockChunks) {
    if (abortSignal?.aborted) break;

    buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop(); // Keep incomplete chunk in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const jsonStr = trimmed.replace(/^data:\s*/, '');
      if (!jsonStr) continue;

      let data;
      try {
        data = JSON.parse(jsonStr);
      } catch {
        continue;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.text) {
        tokens.push(data.text);
      }

      if (data.done) {
        receivedDone = true;
        break;
      }
    }
  }

  // Trailing buffer flush
  if (buffer && buffer.trim().startsWith('data:')) {
    const jsonStr = buffer.trim().replace(/^data:\s*/, '');
    if (jsonStr) {
      let data;
      try {
        data = JSON.parse(jsonStr);
      } catch {
        data = null;
      }

      if (data) {
        if (data.error) throw new Error(data.error);
        if (data.text) tokens.push(data.text);
        if (data.done) receivedDone = true;
      }
    }
  }

  if (!receivedDone && !abortSignal?.aborted) {
    throw new Error('Connection closed before AI response was complete.');
  }

  return { receivedDone, fullText: tokens.join('') };
}

describe('SSE Stream Parser & Error Handling', () => {
  test('successfully accumulates tokens and terminates on done:true', async () => {
    const chunks = [
      'data: {"text":"Hello "}\n\n',
      'data: {"text":"world!"}\n\n',
      'data: {"done":true}\n\n'
    ];

    const result = await processSseStream(chunks, null);
    assert.equal(result.receivedDone, true);
    assert.equal(result.fullText, 'Hello world!');
  });

  test('parses trailing chunk in buffer when final newline is omitted', async () => {
    const chunks = [
      'data: {"text":"Part 1"}\n\n',
      'data: {"text":" and Part 2"}\n\ndata: {"done":true}' // trailing without \n\n
    ];

    const result = await processSseStream(chunks, null);
    assert.equal(result.receivedDone, true);
    assert.equal(result.fullText, 'Part 1 and Part 2');
  });

  test('throws when server returns error event in SSE chunk', async () => {
    const chunks = [
      'data: {"text":"Hello "}\n\n',
      'data: {"error":"Gemini API quota exhausted.","done":true}\n\n'
    ];

    await assert.rejects(async () => {
      await processSseStream(chunks, null);
    }, /Gemini API quota exhausted/);
  });

  test('detects abrupt network drop when connection ends without done:true', async () => {
    // Network drops after first token without done:true event
    const chunks = [
      'data: {"text":"Incomplete message..."}\n\n'
    ];

    await assert.rejects(async () => {
      await processSseStream(chunks, null);
    }, /Connection closed before AI response was complete/);
  });

  test('does not throw incomplete error if aborted intentionally by user', async () => {
    const controller = new AbortController();
    const chunks = [
      'data: {"text":"Starting output..."}\n\n'
    ];

    // Abort after first chunk
    controller.abort();

    const result = await processSseStream(chunks, controller.signal);
    assert.equal(result.receivedDone, false);
    assert.equal(result.fullText, '');
  });
});
