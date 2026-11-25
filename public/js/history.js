/**
 * NexoAI - Chat History Manager
 * Multi-chat persistence with LocalStorage, auto-naming, grouping, search, export & import.
 */

export class ChatHistoryManager {
  static STORAGE_KEY = 'nexo_conversations';
  static LEGACY_STORAGE_KEY = 'nova_conversations';
  static ACTIVE_CHAT_KEY = 'nexo_active_chat_id';
  static LEGACY_ACTIVE_CHAT_KEY = 'nova_active_chat_id';

  constructor() {
    this.conversations = this.loadFromStorage();
    this.pruneEmptyConversations();
  }

  /**
   * Generate a unique ID
   */
  static generateId() {
    return 'chat_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Load conversations from LocalStorage with error resilience and legacy migration
   */
  loadFromStorage() {
    try {
      const raw = localStorage.getItem(ChatHistoryManager.STORAGE_KEY) ||
                  localStorage.getItem(ChatHistoryManager.LEGACY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to load chat history from LocalStorage:', e);
      return [];
    }
  }

  /**
   * Save conversations to LocalStorage with QuotaExceededError resilience
   */
  saveToStorage() {
    try {
      localStorage.setItem(ChatHistoryManager.STORAGE_KEY, JSON.stringify(this.conversations));
    } catch (e) {
      console.error('LocalStorage write error:', e);

      // Handle browser storage quota exhaustion
      const isQuotaError = e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014;
      if (isQuotaError) {
        // Try emergency cleanup: prune oldest non-pinned conversation with messages
        const unpinnedIndex = this.conversations.findLastIndex(c => !c.pinned);
        if (unpinnedIndex !== -1 && this.conversations.length > 3) {
          console.warn('LocalStorage quota reached. Auto-pruning oldest unpinned chat to preserve active session.');
          this.conversations.splice(unpinnedIndex, 1);
          try {
            localStorage.setItem(ChatHistoryManager.STORAGE_KEY, JSON.stringify(this.conversations));
          } catch {
            // Still failing
          }
        }

        if (typeof this.onQuotaError === 'function') {
          this.onQuotaError();
        }
      }
    }
  }

  /**
   * Get active conversation ID from storage
   */
  getActiveChatId() {
    return localStorage.getItem(ChatHistoryManager.ACTIVE_CHAT_KEY) ||
           localStorage.getItem(ChatHistoryManager.LEGACY_ACTIVE_CHAT_KEY);
  }

  /**
   * Set active conversation ID
   */
  setActiveChatId(id) {
    if (id) {
      localStorage.setItem(ChatHistoryManager.ACTIVE_CHAT_KEY, id);
    } else {
      localStorage.removeItem(ChatHistoryManager.ACTIVE_CHAT_KEY);
    }
  }

  /**
   * Automatically generate title from first user message
   */
  static generateTitleFromMessage(messageText) {
    if (!messageText) return 'New Conversation';
    let clean = messageText.replace(/[#*`~_>\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length > 35) {
      clean = clean.substring(0, 35).trim() + '...';
    }
    return clean || 'New Conversation';
  }

  /**
   * Create a new conversation
   */
  createConversation(initialTitle = 'New Conversation') {
    const newConv = {
      id: ChatHistoryManager.generateId(),
      title: initialTitle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pinned: false,
      messages: []
    };

    this.conversations.unshift(newConv);
    this.saveToStorage();
    this.setActiveChatId(newConv.id);
    return newConv;
  }

  /**
   * Get a conversation by ID
   */
  getConversation(id) {
    return this.conversations.find(c => c.id === id) || null;
  }

  /**
   * Get all conversations sorted: pinned first, then by updatedAt descending
   */
  getAllConversations() {
    return [...this.conversations].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    });
  }

  /**
   * Update conversation title or metadata
   */
  updateConversation(id, updates = {}) {
    const conv = this.getConversation(id);
    if (!conv) return null;

    Object.assign(conv, updates, {
      updatedAt: new Date().toISOString()
    });

    this.saveToStorage();
    return conv;
  }

  /**
   * Toggle pinned state
   */
  togglePin(id) {
    const conv = this.getConversation(id);
    if (!conv) return false;
    conv.pinned = !conv.pinned;
    conv.updatedAt = new Date().toISOString();
    this.saveToStorage();
    return conv.pinned;
  }

  /**
   * Rename conversation
   */
  renameConversation(id, newTitle) {
    const conv = this.getConversation(id);
    if (!conv) return false;
    const cleanTitle = (newTitle || '').trim();
    if (cleanTitle) {
      conv.title = cleanTitle;
      conv.updatedAt = new Date().toISOString();
      this.saveToStorage();
      return true;
    }
    return false;
  }

  /**
   * Add message to conversation
   */
  addMessage(id, message) {
    const conv = this.getConversation(id);
    if (!conv) return null;

    const messageObj = {
      id: message.id || ('msg_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6)),
      role: message.role || 'user',
      content: message.content || '',
      type: message.type || 'text',
      imageUrl: message.imageUrl || null,
      aspectRatio: message.aspectRatio || null,
      provider: message.provider || null,
      prompt: message.prompt || null,
      timestamp: message.timestamp || new Date().toISOString(),
      reaction: message.reaction || null
    };

    conv.messages.push(messageObj);

    // Auto-update conversation title from first user message if default
    if (conv.messages.length === 1 && conv.title === 'New Conversation' && message.role === 'user') {
      conv.title = ChatHistoryManager.generateTitleFromMessage(message.content);
    }

    conv.updatedAt = new Date().toISOString();
    this.saveToStorage();
    return messageObj;
  }

  /**
   * Update specific message in a conversation (e.g. streaming update, reaction, edited content)
   */
  updateMessage(convId, msgId, updates) {
    const conv = this.getConversation(convId);
    if (!conv) return null;

    const msg = conv.messages.find(m => m.id === msgId);
    if (!msg) return null;

    Object.assign(msg, updates);
    conv.updatedAt = new Date().toISOString();
    this.saveToStorage();
    return msg;
  }

  /**
   * Truncate messages in conversation to restart from an edited message
   */
  truncateMessagesFrom(convId, messageId) {
    const conv = this.getConversation(convId);
    if (!conv) return null;

    const index = conv.messages.findIndex(m => m.id === messageId);
    if (index === -1) return null;

    // Keep messages strictly before this message
    conv.messages = conv.messages.slice(0, index);
    conv.updatedAt = new Date().toISOString();
    this.saveToStorage();
    return conv;
  }

  /**
   * Delete conversation
   */
  deleteConversation(id) {
    const index = this.conversations.findIndex(c => c.id === id);
    if (index === -1) return false;

    this.conversations.splice(index, 1);
    this.saveToStorage();

    if (this.getActiveChatId() === id) {
      const remaining = this.getAllConversations();
      this.setActiveChatId(remaining.length > 0 ? remaining[0].id : null);
    }

    return true;
  }

  /**
   * Clear all conversations
   */
  clearAllConversations() {
    this.conversations = [];
    this.saveToStorage();
    this.setActiveChatId(null);
  }

  /**
   * Remove a specific message from conversation (e.g. clean up failed generation)
   */
  removeMessage(convId, msgId) {
    const conv = this.getConversation(convId);
    if (!conv) return false;

    const index = conv.messages.findIndex(m => m.id === msgId);
    if (index === -1) return false;

    conv.messages.splice(index, 1);
    conv.updatedAt = new Date().toISOString();
    this.saveToStorage();
    return true;
  }

  /**
   * Prune abandoned empty conversations (e.g. 0 messages)
   * Preserves currently active empty conversation so a newly opened chat isn't immediately lost.
   */
  pruneEmptyConversations() {
    const activeId = this.getActiveChatId();
    const originalCount = this.conversations.length;
    this.conversations = this.conversations.filter(c => {
      const hasMessages = Array.isArray(c.messages) && c.messages.length > 0;
      return hasMessages || c.id === activeId;
    });
    if (this.conversations.length !== originalCount) {
      this.saveToStorage();
    }
  }

  /**
   * Group conversations chronologically: Pinned, Today, Yesterday, Previous 7 Days, Older
   */
  getGroupedConversations(filterQuery = '') {
    const all = this.getAllConversations();
    const query = filterQuery.toLowerCase().trim();

    const filtered = query
      ? all.filter(c => {
          if (c.title.toLowerCase().includes(query)) return true;
          return c.messages.some(m => m.content && m.content.toLowerCase().includes(query));
        })
      : all;

    const pinned = [];
    const today = [];
    const yesterday = [];
    const previous7Days = [];
    const older = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - (24 * 60 * 60 * 1000);
    const sevenDaysStart = todayStart - (7 * 24 * 60 * 60 * 1000);

    for (const conv of filtered) {
      if (conv.pinned) {
        pinned.push(conv);
        continue;
      }

      const convTime = new Date(conv.updatedAt || conv.createdAt).getTime();
      if (convTime >= todayStart) {
        today.push(conv);
      } else if (convTime >= yesterdayStart) {
        yesterday.push(conv);
      } else if (convTime >= sevenDaysStart) {
        previous7Days.push(conv);
      } else {
        older.push(conv);
      }
    }

    return {
      pinned,
      today,
      yesterday,
      previous7Days,
      older,
      totalCount: filtered.length
    };
  }

  /**
   * Export conversation as JSON or TXT file download
   */
  exportConversation(id, format = 'json') {
    const conv = this.getConversation(id);
    if (!conv) return false;

    let content = '';
    let mimeType = 'application/json';
    let filename = `NexoAI_${conv.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`;

    if (format === 'txt') {
      mimeType = 'text/plain;charset=utf-8';
      filename += '.txt';
      content += `NexoAI Conversation: ${conv.title}\n`;
      content += `Date: ${new Date(conv.createdAt).toLocaleString()}\n`;
      content += `========================================================\n\n`;

      for (const msg of conv.messages) {
        const sender = msg.role === 'user' ? 'YOU' : 'NEXOAI';
        const time = new Date(msg.timestamp).toLocaleTimeString();
        content += `[${time}] ${sender}:\n${msg.content}\n\n--------------------------------------------------------\n\n`;
      }
    } else {
      filename += '.json';
      content = JSON.stringify(conv, null, 2);
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }

  /**
   * Validate, sanitize and construct a conversation object from imported data
   */
  static sanitizeImportedConversation(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid format: conversation must be an object.');
    }

    const rawTitle = typeof data.title === 'string' ? data.title.trim() : '';
    const title = rawTitle ? rawTitle.substring(0, 100) : 'Imported Chat';

    const rawMessages = Array.isArray(data.messages) ? data.messages : [];
    // Limit to max 100 messages per imported conversation to protect storage
    const boundedMessages = rawMessages.slice(0, 100);

    const validMessages = [];
    for (const m of boundedMessages) {
      if (!m || typeof m !== 'object') continue;

      const rawContent = typeof m.content === 'string' ? m.content : '';
      if (!rawContent.trim()) continue;

      // Limit individual message to max 30,000 characters
      const content = rawContent.length > 30000 ? rawContent.substring(0, 30000) : rawContent;
      const rawRole = (m.role || '').toLowerCase();
      const role = (rawRole === 'assistant' || rawRole === 'model') ? 'assistant' : 'user';

      validMessages.push({
        id: ('msg_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6)),
        role,
        content,
        timestamp: m.timestamp || new Date().toISOString(),
        reaction: (m.reaction === 'like' || m.reaction === 'dislike') ? m.reaction : null
      });
    }

    return {
      id: ChatHistoryManager.generateId(),
      title,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pinned: Boolean(data.pinned),
      messages: validMessages
    };
  }

  /**
   * Import one or more conversations with schema validation and size bounds
   * @param {string|Array|Object} inputData - JSON string or parsed object/array
   * @returns {number} Count of successfully imported conversations
   */
  importConversations(inputData) {
    let parsed;
    if (typeof inputData === 'string') {
      if (inputData.length > 2 * 1024 * 1024) {
        throw new Error('Import failed: File exceeds maximum allowed size of 2 MB.');
      }
      try {
        parsed = JSON.parse(inputData);
      } catch {
        throw new Error('Import failed: Invalid JSON format.');
      }
    } else {
      parsed = inputData;
    }

    const items = Array.isArray(parsed) ? parsed : [parsed];

    if (items.length === 0) {
      throw new Error('Import failed: No conversation data found.');
    }

    // Limit batch import to max 50 conversations at once
    const batch = items.slice(0, 50);
    const sanitized = [];

    for (let i = 0; i < batch.length; i++) {
      try {
        const conv = ChatHistoryManager.sanitizeImportedConversation(batch[i]);
        sanitized.push(conv);
      } catch (err) {
        throw new Error(`Import failed at item ${i + 1}: ${err.message}`);
      }
    }

    if (sanitized.length === 0) {
      throw new Error('Import failed: No valid conversations could be parsed.');
    }

    // Prepend all conversations and save once
    this.conversations.unshift(...sanitized);
    this.saveToStorage();
    this.setActiveChatId(sanitized[0].id);

    return sanitized.length;
  }

  /**
   * Backward-compatible alias for importing a single conversation
   */
  importConversation(jsonString) {
    this.importConversations(jsonString);
    return this.getConversation(this.getActiveChatId());
  }
}
