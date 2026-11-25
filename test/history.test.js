import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Set up mock localStorage before importing history module
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) || null,
  setItem: (key, val) => store.set(key, String(val)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear()
};

const { ChatHistoryManager } = await import('../public/js/history.js');

describe('ChatHistoryManager', () => {
  let manager;

  beforeEach(() => {
    store.clear();
    manager = new ChatHistoryManager();
  });

  test('creates a conversation and sets it as active chat', () => {
    const conv = manager.createConversation('Test Topic');
    assert.ok(conv.id);
    assert.equal(conv.title, 'Test Topic');
    assert.equal(conv.messages.length, 0);
    assert.equal(manager.getActiveChatId(), conv.id);
  });

  test('adds user message and auto-generates title from initial prompt', () => {
    const conv = manager.createConversation('New Conversation');
    manager.addMessage(conv.id, {
      role: 'user',
      content: 'Explain async await in JavaScript in depth'
    });

    const updated = manager.getConversation(conv.id);
    assert.equal(updated.messages.length, 1);
    assert.equal(updated.messages[0].role, 'user');
    assert.notEqual(updated.title, 'New Conversation');
    assert.ok(updated.title.includes('Explain async await'));
  });

  test('removeMessage deletes specific message without disturbing remaining messages', () => {
    const conv = manager.createConversation('Multi Message Chat');
    const msg1 = manager.addMessage(conv.id, { role: 'user', content: 'What is 2+2?' });
    const msg2 = manager.addMessage(conv.id, { role: 'assistant', content: 'It is 4.' });
    const msg3 = manager.addMessage(conv.id, { role: 'assistant', content: 'Error: Failed generation' });

    assert.equal(manager.getConversation(conv.id).messages.length, 3);

    // Simulate removing failed placeholder on generation error
    const removed = manager.removeMessage(conv.id, msg3.id);
    assert.equal(removed, true);

    const afterRemove = manager.getConversation(conv.id);
    assert.equal(afterRemove.messages.length, 2);
    assert.equal(afterRemove.messages[0].id, msg1.id);
    assert.equal(afterRemove.messages[1].id, msg2.id);
  });

  test('truncateMessagesFrom removes messages from the edited message onwards', () => {
    const conv = manager.createConversation('Edit Flow');
    const msg1 = manager.addMessage(conv.id, { role: 'user', content: 'Question 1' });
    const msg2 = manager.addMessage(conv.id, { role: 'assistant', content: 'Answer 1' });
    const msg3 = manager.addMessage(conv.id, { role: 'user', content: 'Question 2 (to edit)' });
    const msg4 = manager.addMessage(conv.id, { role: 'assistant', content: 'Answer 2' });

    manager.truncateMessagesFrom(conv.id, msg3.id);

    const truncated = manager.getConversation(conv.id);
    assert.equal(truncated.messages.length, 2);
    assert.equal(truncated.messages[0].id, msg1.id);
    assert.equal(truncated.messages[1].id, msg2.id);
  });

  test('pruneEmptyConversations preserves active empty chat but cleans abandoned empty ones', () => {
    // Conv 1: Empty and abandoned
    const conv1 = manager.createConversation('Abandoned Empty');
    // Conv 2: Has messages
    const conv2 = manager.createConversation('Has Content');
    manager.addMessage(conv2.id, { role: 'user', content: 'Hello' });
    // Conv 3: Active newly created empty chat
    const conv3 = manager.createConversation('Active Empty');
    manager.setActiveChatId(conv3.id);

    manager.pruneEmptyConversations();

    const remaining = manager.getAllConversations();
    // Conv 1 should be pruned, conv2 (has content) and conv3 (active empty) preserved
    assert.equal(remaining.length, 2);
    assert.ok(remaining.some(c => c.id === conv2.id));
    assert.ok(remaining.some(c => c.id === conv3.id));
    assert.ok(!remaining.some(c => c.id === conv1.id));
  });

  describe('sanitizeImportedConversation & importConversations', () => {
    test('sanitizes imported conversation with title bounds, message bounds and role normalization', () => {
      const longTitle = 'T'.repeat(200);
      const longContent = 'C'.repeat(35000);
      const rawData = {
        title: longTitle,
        pinned: true,
        messages: [
          { role: 'model', content: 'First message' },
          { role: 'user', content: longContent },
          { role: 'assistant', content: '   ' } // Empty, should be omitted
        ]
      };

      const sanitized = ChatHistoryManager.sanitizeImportedConversation(rawData);
      assert.equal(sanitized.title.length, 100);
      assert.equal(sanitized.pinned, true);
      assert.equal(sanitized.messages.length, 2);
      // 'model' normalized to 'assistant'
      assert.equal(sanitized.messages[0].role, 'assistant');
      assert.equal(sanitized.messages[0].content, 'First message');
      // Content bounded to 30,000 characters
      assert.equal(sanitized.messages[1].content.length, 30000);
    });

    test('imports batch conversations JSON and persists them', () => {
      const importPayload = JSON.stringify([
        {
          title: 'Imported Conversation 1',
          messages: [{ role: 'user', content: 'Hi 1' }]
        },
        {
          title: 'Imported Conversation 2',
          messages: [{ role: 'user', content: 'Hi 2' }]
        }
      ]);

      const count = manager.importConversations(importPayload);
      assert.equal(count, 2);

      const all = manager.getAllConversations();
      assert.equal(all.length, 2);
      assert.equal(all[0].title, 'Imported Conversation 1');
      assert.equal(all[1].title, 'Imported Conversation 2');
    });

    test('rejects import payloads larger than 2MB', () => {
      const hugePayload = ' '.repeat(2 * 1024 * 1024 + 10);
      assert.throws(() => {
        manager.importConversations(hugePayload);
      }, /exceeds maximum allowed size of 2 MB/);
    });

    test('rejects malformed JSON string on import', () => {
      assert.throws(() => {
        manager.importConversations('{ malformed: true, ');
      }, /Invalid JSON format/);
    });
  });
});
