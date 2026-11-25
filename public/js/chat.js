/**
 * NexoAI - Chat Controller
 * Manages chat interactions, SSE streaming with typewriter buffer, message rendering & actions.
 */

import { MarkdownRenderer } from './markdown.js';
import { UIController } from './ui.js';

export class ChatController {
  constructor({ historyManager, settingsManager, uiController }) {
    this.history = historyManager;
    this.settings = settingsManager;
    this.ui = uiController;

    this.activeAbortController = null;
    this.isStreaming = false;

    // Typewriter buffer state
    this.tokenQueue = [];
    this.typewriterTimer = null;
    this.currentAssistantMessage = null;
    this.accumulatedText = '';

    this.bindMessageActionEvents();
  }

  /**
   * Render all messages for the currently active conversation
   */
  renderActiveConversation() {
    const activeId = this.history.getActiveChatId();
    const conv = activeId ? this.history.getConversation(activeId) : null;

    if (!this.ui.messagesInner) return;
    this.ui.messagesInner.innerHTML = '';

    if (!conv || !conv.messages || conv.messages.length === 0) {
      this.ui.toggleWelcomeScreen(true);
      this.ui.setCurrentChatTitle(conv ? conv.title : 'NexoAI');
      return;
    }

    this.ui.toggleWelcomeScreen(false);
    this.ui.setCurrentChatTitle(conv.title);

    for (const msg of conv.messages) {
      this.appendMessageToDOM(msg, false);
    }

    this.ui.scrollToBottom(false);
  }

  /**
   * Append a single message element to DOM
   */
  appendMessageToDOM(message, animate = true) {
    const isUser = message.role === 'user';
    const row = document.createElement('div');
    row.className = `message-row ${isUser ? 'user' : 'assistant'}`;
    row.id = `msg-row-${message.id}`;
    row.setAttribute('data-msg-id', message.id);

    const formattedTime = UIController.formatTimestamp(message.timestamp);

    if (isUser) {
      row.innerHTML = `
        <div class="message-body-wrapper">
          <div class="message-bubble">${MarkdownRenderer.escapeHtml(message.content)}</div>
          <div class="message-footer">
            <span class="message-time">${formattedTime}</span>
            <button class="user-edit-btn" title="Edit message" data-msg-id="${message.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </button>
          </div>
        </div>
        <div class="message-avatar user-avatar" title="You">U</div>
      `;
    } else {
      const renderedContent = MarkdownRenderer.render(message.content, false);
      const isLiked = message.reaction === 'like';
      const isDisliked = message.reaction === 'dislike';

      row.innerHTML = `
        <div class="message-avatar assistant-avatar" title="NexoAI">
          <img src="assets/logo.svg" alt="NexoAI">
        </div>
        <div class="message-body-wrapper">
          <div class="message-bubble markdown-body">${renderedContent}</div>
          <div class="message-footer">
            <span class="message-time">${formattedTime}</span>
            <div class="message-actions-bar">
              <button class="msg-action-btn copy-msg-btn" title="Copy response" data-msg-id="${message.id}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Copy</span>
              </button>
              <button class="msg-action-btn regenerate-btn" title="Regenerate response" data-msg-id="${message.id}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                <span>Regenerate</span>
              </button>
              <button class="msg-action-btn like-btn ${isLiked ? 'active' : ''}" title="Helpful response" data-msg-id="${message.id}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                </svg>
              </button>
              <button class="msg-action-btn dislike-btn ${isDisliked ? 'active' : ''}" title="Unhelpful response" data-msg-id="${message.id}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }

    this.ui.messagesInner.appendChild(row);
    return row;
  }

  /**
   * Send a user message and initiate streaming response
   */
  async sendMessage(customText = null) {
    if (this.isStreaming) return;

    const rawText = customText !== null ? customText : this.ui.chatInput.value;
    const text = (rawText || '').trim();
    if (!text) return;

    // Clear input and reset height
    this.ui.chatInput.value = '';
    this.ui.resetInputHeight();
    this.ui.updateCharCounter();
    this.ui.updateSendButtonState();

    // Get or create conversation
    let activeId = this.history.getActiveChatId();
    let conv = activeId ? this.history.getConversation(activeId) : null;

    if (!conv) {
      conv = this.history.createConversation();
      activeId = conv.id;
    }

    this.ui.toggleWelcomeScreen(false);

    // 1. Add user message
    const userMsg = this.history.addMessage(activeId, {
      role: 'user',
      content: text
    });
    this.appendMessageToDOM(userMsg);
    this.ui.setCurrentChatTitle(conv.title);
    this.ui.scrollToBottom(true);

    // 2. Prepare assistant placeholder message
    const assistantMsg = this.history.addMessage(activeId, {
      role: 'assistant',
      content: ''
    });

    const assistantRow = this.appendMessageToDOM(assistantMsg);
    const bubbleEl = assistantRow.querySelector('.message-bubble');
    const actionsBar = assistantRow.querySelector('.message-actions-bar');
    if (actionsBar) actionsBar.style.display = 'none';

    // Show initial typing indicator
    bubbleEl.innerHTML = `<span class="streaming-cursor"></span>`;

    // 3. Initiate SSE Streaming
    this.isStreaming = true;
    this.ui.setGeneratingState(true);
    this.activeAbortController = new AbortController();
    this.accumulatedText = '';
    this.tokenQueue = [];
    this.currentAssistantMessage = {
      convId: activeId,
      msgId: assistantMsg.id,
      rowEl: assistantRow,
      bubbleEl
    };

    // Start typewriter loop
    this.startTypewriterLoop();

    let generationSucceeded = false;
    try {
      // Gather context messages up to limit
      const contextLimit = this.settings.get('contextLimit') || 20;
      const conversationMessages = conv.messages.slice(0, -1); // exclude empty assistant placeholder
      const messagesPayload = conversationMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const headers = {
        'Content-Type': 'application/json'
      };

      const customApiKey = this.settings.get('customApiKey');
      if (customApiKey && customApiKey.trim().length > 0) {
        headers['x-api-key'] = customApiKey.trim();
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: messagesPayload,
          model: this.settings.get('model'),
          customSystemPrompt: this.settings.get('customSystemPrompt'),
          maxTurns: contextLimit
        }),
        signal: this.activeAbortController.signal
      });

      if (!response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let receivedDone = false;

      try {
        while (!receivedDone) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
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
              // Ignore malformed intermediate JSON chunk
              continue;
            }

            if (data.error) {
              throw new Error(data.error);
            }

            if (data.text) {
              // Push text characters/tokens to typewriter queue
              this.enqueueTokens(data.text);
            }

            if (data.done) {
              receivedDone = true;
              break;
            }
          }
        }

        // Process any remaining data in buffer after stream completes
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
              if (data.text) this.enqueueTokens(data.text);
              if (data.done) receivedDone = true;
            }
          }
        }

        // Detect unexpected stream termination (e.g. dropped network connection)
        if (!receivedDone && !this.activeAbortController?.signal.aborted) {
          throw new Error('Connection closed before AI response was complete.');
        }
      } finally {
        try {
          await reader.cancel();
        } catch {}
      }

      generationSucceeded = receivedDone;
    } catch (err) {
      if (err.name === 'AbortError') {
        this.handleGenerationStopped();
      } else {
        this.handleGenerationError(err.message);
      }
    } finally {
      if (generationSucceeded) {
        this.finalizeStreaming();
      }
    }
  }

  /**
   * Push incoming chunks into typewriter queue
   */
  enqueueTokens(text) {
    // Break into small chunks (2-4 chars) for smooth, natural streaming pacing
    const chunkSize = 3;
    for (let i = 0; i < text.length; i += chunkSize) {
      this.tokenQueue.push(text.slice(i, i + chunkSize));
    }
  }

  /**
   * Start typewriter pacing loop (~18ms interval)
   */
  startTypewriterLoop() {
    if (this.typewriterTimer) clearInterval(this.typewriterTimer);

    this.typewriterTimer = setInterval(() => {
      if (!this.currentAssistantMessage) {
        clearInterval(this.typewriterTimer);
        this.typewriterTimer = null;
        return;
      }

      if (this.tokenQueue.length > 0) {
        // Drain tokens with adaptive speed for bursts
        const drainCount = this.tokenQueue.length > 100 ? 5 : (this.tokenQueue.length > 30 ? 2 : 1);
        for (let i = 0; i < drainCount && this.tokenQueue.length > 0; i++) {
          this.accumulatedText += this.tokenQueue.shift();
        }

        // Render progressive markdown with active cursor
        const rendered = MarkdownRenderer.render(this.accumulatedText, true);
        this.currentAssistantMessage.bubbleEl.innerHTML = `${rendered}<span class="streaming-cursor"></span>`;

        this.ui.scrollToBottom(true);
      } else if (!this.isStreaming) {
        // Queue is drained and network stream ended
        clearInterval(this.typewriterTimer);
        this.typewriterTimer = null;
        this.finishMessageRendering();
      }
    }, 18);
  }

  /**
   * Finalize message render after streaming completes
   */
  finishMessageRendering() {
    if (!this.currentAssistantMessage) return;

    const { convId, msgId, rowEl, bubbleEl } = this.currentAssistantMessage;

    // Save full accumulated text to history
    this.history.updateMessage(convId, msgId, {
      content: this.accumulatedText
    });

    // Final clean Markdown render without streaming cursor
    bubbleEl.innerHTML = MarkdownRenderer.render(this.accumulatedText, false);

    // Show actions toolbar
    const actionsBar = rowEl.querySelector('.message-actions-bar');
    if (actionsBar) actionsBar.style.display = 'flex';

    this.currentAssistantMessage = null;
    this.ui.setGeneratingState(false);
    this.isStreaming = false;
    this.activeAbortController = null;
    this.ui.scrollToBottom(true);
  }

  /**
   * Finalize streaming state
   */
  finalizeStreaming() {
    this.isStreaming = false;
    if (this.tokenQueue.length === 0) {
      this.finishMessageRendering();
    }
  }

  /**
   * Stop generation action
   */
  stopGeneration() {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
  }

  /**
   * Handle user aborted generation
   */
  handleGenerationStopped() {
    if (this.typewriterTimer) {
      clearInterval(this.typewriterTimer);
      this.typewriterTimer = null;
    }
    this.tokenQueue = [];

    if (this.currentAssistantMessage) {
      const { convId, msgId, rowEl, bubbleEl } = this.currentAssistantMessage;

      const trimmedText = (this.accumulatedText || '').trim();

      if (trimmedText.length > 0) {
        // User stopped after partial content: preserve generated text in history
        this.history.updateMessage(convId, msgId, {
          content: this.accumulatedText
        });

        const rendered = MarkdownRenderer.render(this.accumulatedText, false);
        bubbleEl.innerHTML = `
          ${rendered}
          <div class="stopped-indicator">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            </svg>
            <span>You stopped this response.</span>
          </div>
        `;

        const actionsBar = rowEl.querySelector('.message-actions-bar');
        if (actionsBar) actionsBar.style.display = 'flex';
      } else {
        // Stopped before anything was generated: remove empty placeholder message
        this.history.removeMessage(convId, msgId);
        rowEl.remove();
      }

      this.currentAssistantMessage = null;
    }

    this.isStreaming = false;
    this.activeAbortController = null;
    this.ui.setGeneratingState(false);
    this.ui.showToast('Response generation stopped.', 'info', 2000);
    this.ui.scrollToBottom(true);
  }

  /**
   * Handle generation error (API error, rate limit, quota, etc.)
   */
  handleGenerationError(errorMessage) {
    if (this.typewriterTimer) {
      clearInterval(this.typewriterTimer);
      this.typewriterTimer = null;
    }
    this.tokenQueue = [];

    if (this.currentAssistantMessage) {
      const { convId, msgId, rowEl, bubbleEl } = this.currentAssistantMessage;

      // Crucial: remove failed placeholder message from history so error text
      // is never saved into LocalStorage or sent to Gemini in future turns
      this.history.removeMessage(convId, msgId);

      const partialRender = this.accumulatedText ? MarkdownRenderer.render(this.accumulatedText, false) : '';

      bubbleEl.innerHTML = `
        ${partialRender}
        <div class="message-error-card">
          <div class="error-title-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>Generation Failed</span>
          </div>
          <div class="error-message-text">${MarkdownRenderer.escapeHtml(errorMessage)}</div>
          <div>
            <button class="msg-action-btn retry-btn" data-retry-conv="${convId}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              <span>Retry Generation</span>
            </button>
          </div>
        </div>
      `;

      const actionsBar = rowEl.querySelector('.message-actions-bar');
      if (actionsBar) actionsBar.style.display = 'none';

      this.currentAssistantMessage = null;
    }

    this.isStreaming = false;
    this.activeAbortController = null;
    this.ui.setGeneratingState(false);
    this.ui.showToast(errorMessage, 'error', 4500);
    this.ui.scrollToBottom(true);
  }

  /**
   * Message Actions event delegation (Copy, Regenerate, Edit, Like, Dislike, Retry)
   */
  bindMessageActionEvents() {
    if (!this.ui.messagesContainer) return;

    this.ui.messagesContainer.addEventListener('click', (e) => {
      // 1. Copy complete response
      const copyBtn = e.target.closest('.copy-msg-btn');
      if (copyBtn) {
        const msgId = copyBtn.getAttribute('data-msg-id');
        this.copyMessageContent(msgId, copyBtn);
        return;
      }

      // 2. Copy code block inside card
      const copyCodeBtn = e.target.closest('.copy-code-btn');
      if (copyCodeBtn) {
        const encoded = copyCodeBtn.getAttribute('data-code');
        const code = decodeURIComponent(encoded || '');
        this.copyCodeContent(code, copyCodeBtn);
        return;
      }

      // 3. Regenerate response
      const regenBtn = e.target.closest('.regenerate-btn');
      if (regenBtn) {
        const msgId = regenBtn.getAttribute('data-msg-id');
        this.regenerateResponse(msgId);
        return;
      }

      // 4. Edit user message
      const editBtn = e.target.closest('.user-edit-btn');
      if (editBtn) {
        const msgId = editBtn.getAttribute('data-msg-id');
        this.editUserMessage(msgId);
        return;
      }

      // 5. Like / Dislike reactions
      const likeBtn = e.target.closest('.like-btn');
      if (likeBtn) {
        const msgId = likeBtn.getAttribute('data-msg-id');
        this.toggleReaction(msgId, 'like', likeBtn);
        return;
      }

      const dislikeBtn = e.target.closest('.dislike-btn');
      if (dislikeBtn) {
        const msgId = dislikeBtn.getAttribute('data-msg-id');
        this.toggleReaction(msgId, 'dislike', dislikeBtn);
        return;
      }

      // 6. Retry button on error
      const retryBtn = e.target.closest('.retry-btn');
      if (retryBtn) {
        this.retryLastResponse();
        return;
      }
    });
  }

  /**
   * Copy message text to clipboard with temporary feedback
   */
  async copyMessageContent(msgId, buttonEl) {
    const activeId = this.history.getActiveChatId();
    const conv = this.history.getConversation(activeId);
    if (!conv) return;

    const msg = conv.messages.find(m => m.id === msgId);
    if (!msg) return;

    try {
      await navigator.clipboard.writeText(msg.content);
      const span = buttonEl.querySelector('span');
      const originalText = span ? span.textContent : 'Copy';
      if (span) span.textContent = 'Copied!';
      buttonEl.style.color = 'var(--color-success)';

      this.ui.showToast('Copied response to clipboard', 'success', 2000);

      setTimeout(() => {
        if (span) span.textContent = originalText;
        buttonEl.style.color = '';
      }, 2000);
    } catch {
      this.ui.showToast('Failed to copy to clipboard', 'error');
    }
  }

  /**
   * Copy code snippet to clipboard with temporary checkmark feedback
   */
  async copyCodeContent(codeText, buttonEl) {
    try {
      await navigator.clipboard.writeText(codeText);
      const span = buttonEl.querySelector('span');
      const originalText = span ? span.textContent : 'Copy Code';

      buttonEl.classList.add('copied');
      if (span) span.textContent = 'Copied!';

      this.ui.showToast('Code copied to clipboard', 'success', 1800);

      setTimeout(() => {
        buttonEl.classList.remove('copied');
        if (span) span.textContent = originalText;
      }, 2000);
    } catch {
      this.ui.showToast('Failed to copy code snippet', 'error');
    }
  }

  /**
   * Regenerate assistant response
   */
  regenerateResponse(assistantMsgId) {
    if (this.isStreaming) return;

    const activeId = this.history.getActiveChatId();
    const conv = this.history.getConversation(activeId);
    if (!conv) return;

    const index = conv.messages.findIndex(m => m.id === assistantMsgId);
    if (index === -1) return;

    // Find the corresponding user prompt before this assistant message
    let userPrompt = '';
    let userIndex = -1;
    for (let i = index - 1; i >= 0; i--) {
      if (conv.messages[i].role === 'user') {
        userPrompt = conv.messages[i].content;
        userIndex = i;
        break;
      }
    }

    if (!userPrompt || userIndex === -1) return;

    // Slice strictly before userIndex so this.sendMessage(userPrompt)
    // will re-add the user prompt cleanly without creating consecutive duplicate user messages
    conv.messages = conv.messages.slice(0, userIndex);
    this.history.saveToStorage();

    // Re-render conversation up to before this turn
    this.renderActiveConversation();

    // Re-trigger generation with the user prompt
    this.sendMessage(userPrompt);
  }

  /**
   * Edit user message and resend
   */
  editUserMessage(userMsgId) {
    if (this.isStreaming) return;

    const activeId = this.history.getActiveChatId();
    const conv = this.history.getConversation(activeId);
    if (!conv) return;

    const msg = conv.messages.find(m => m.id === userMsgId);
    if (!msg) return;

    // Put message text into input box
    this.ui.chatInput.value = msg.content;
    this.ui.handleInputResize();
    this.ui.updateCharCounter();
    this.ui.updateSendButtonState();
    this.ui.chatInput.focus();

    // Truncate messages from this point forward
    this.history.truncateMessagesFrom(activeId, userMsgId);
    this.renderActiveConversation();
    this.ui.showToast('Editing message. Press Enter to send.', 'info', 2500);
  }

  /**
   * Retry failed generation
   */
  retryLastResponse() {
    if (this.isStreaming) return;

    const activeId = this.history.getActiveChatId();
    const conv = this.history.getConversation(activeId);
    if (!conv || conv.messages.length === 0) return;

    // Remove any trailing assistant messages
    while (conv.messages.length > 0 && conv.messages[conv.messages.length - 1].role === 'assistant') {
      conv.messages.pop();
    }

    if (conv.messages.length === 0) return;

    // Get last user message
    const lastUserMsg = conv.messages[conv.messages.length - 1];
    if (!lastUserMsg || lastUserMsg.role !== 'user') return;

    const promptText = lastUserMsg.content;
    // Pop user message too so sendMessage will re-add and re-render cleanly
    conv.messages.pop();
    this.history.saveToStorage();

    this.renderActiveConversation();
    this.sendMessage(promptText);
  }

  /**
   * Toggle Like / Dislike reaction
   */
  toggleReaction(msgId, type, buttonEl) {
    const activeId = this.history.getActiveChatId();
    const conv = this.history.getConversation(activeId);
    if (!conv) return;

    const msg = conv.messages.find(m => m.id === msgId);
    if (!msg) return;

    const row = document.getElementById(`msg-row-${msgId}`);
    const likeBtn = row?.querySelector('.like-btn');
    const dislikeBtn = row?.querySelector('.dislike-btn');

    if (msg.reaction === type) {
      msg.reaction = null;
      buttonEl.classList.remove('active');
    } else {
      msg.reaction = type;
      if (likeBtn) likeBtn.classList.toggle('active', type === 'like');
      if (dislikeBtn) dislikeBtn.classList.toggle('active', type === 'dislike');
      this.ui.showToast(type === 'like' ? 'Marked as helpful' : 'Feedback recorded', 'info', 1500);
    }

    this.history.saveToStorage();
  }
}
