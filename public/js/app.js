/**
 * NexoAI - Main Application Entry Point
 * Orchestrates components, binds event handlers, handles keyboard shortcuts, and renders history.
 */

import { SettingsManager } from './settings.js';
import { ChatHistoryManager } from './history.js';
import { UIController } from './ui.js';
import { ChatController } from './chat.js';

class NexoApp {
  constructor() {
    this.settings = new SettingsManager();
    this.history = new ChatHistoryManager();
    this.ui = new UIController();
    this.chat = new ChatController({
      historyManager: this.history,
      settingsManager: this.settings,
      uiController: this.ui
    });

    this.backendStatus = { ok: false, hasApiKey: false, defaultModel: 'gemini-2.5-flash' };

    this.history.onQuotaError = () => {
      this.ui.showToast('Browser storage quota reached. Older unpinned chats were automatically pruned.', 'warning', 6000);
      this.renderSidebarHistory();
    };

    this.init();
  }

  async init() {
    this.restoreSidebarPreference();
    this.renderSidebarHistory();
    this.chat.renderActiveConversation();

    this.bindEvents();
    this.bindKeyboardShortcuts();
    this.initSettingsModalValues();

    await this.checkBackendStatus();
  }

  /**
   * Check backend server status and API key configuration
   */
  async checkBackendStatus() {
    try {
      const res = await fetch('/api/chat/status');
      if (res.ok) {
        this.backendStatus = await res.json();
        this.updateApiKeyStatusIndicator();
      }
    } catch {
      console.warn('Backend status check unreachable.');
    }
  }

  updateApiKeyStatusIndicator() {
    const statusTextEl = document.getElementById('api-key-status-text');
    if (!statusTextEl) return;

    const customKey = this.settings.get('customApiKey');

    if (customKey && customKey.trim().length > 10) {
      statusTextEl.innerHTML = `<span style="color: var(--color-success)">● Custom Session Key active in tab (overrides server)</span>`;
    } else if (this.backendStatus.hasApiKey) {
      statusTextEl.innerHTML = `<span style="color: var(--color-success)">● Active: Configured via server .env (Recommended)</span>`;
    } else {
      statusTextEl.innerHTML = `<span style="color: var(--color-warning)">⚠️ No API Key configured. Add GEMINI_API_KEY to server .env or enter a session key below.</span>`;
    }
  }

  /**
   * Restore desktop sidebar collapsed state
   */
  restoreSidebarPreference() {
    if (window.innerWidth > 768) {
      const isCollapsed = localStorage.getItem('nexo_sidebar_collapsed') === 'true' ||
                          localStorage.getItem('nova_sidebar_collapsed') === 'true';
      if (isCollapsed) {
        this.ui.sidebar.classList.add('collapsed');
      }
    }
  }

  /**
   * Render grouped conversation history in sidebar
   */
  renderSidebarHistory(searchQuery = '') {
    if (!this.ui.historyContainer) return;

    const grouped = this.history.getGroupedConversations(searchQuery);
    const activeId = this.history.getActiveChatId();

    this.ui.historyContainer.innerHTML = '';

    if (grouped.totalCount === 0) {
      this.ui.historyContainer.innerHTML = `
        <div style="padding: 24px 12px; text-align: center; color: var(--text-muted); font-size: 13px;">
          ${searchQuery ? 'No matching conversations found.' : 'No conversations yet.<br>Start a new chat!'}
        </div>
      `;
      return;
    }

    const renderGroup = (title, items, isPinnedGroup = false) => {
      if (!items || items.length === 0) return;

      const groupWrapper = document.createElement('div');
      groupWrapper.className = 'history-group-wrapper';

      const header = document.createElement('div');
      header.className = 'history-group-header';
      const headerTitle = document.createElement('span');
      headerTitle.textContent = title;
      const headerCount = document.createElement('span');
      headerCount.style.fontSize = '10px';
      headerCount.style.opacity = '0.7';
      headerCount.textContent = String(items.length);
      header.appendChild(headerTitle);
      header.appendChild(headerCount);
      groupWrapper.appendChild(header);

      const list = document.createElement('div');
      list.className = 'history-items-list';

      for (const item of items) {
        const itemEl = document.createElement('div');
        itemEl.className = `chat-history-item ${item.id === activeId ? 'active' : ''}`;
        itemEl.setAttribute('data-id', item.id);

        const iconDiv = document.createElement('div');
        iconDiv.className = 'chat-item-icon';
        iconDiv.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;

        const titleSpan = document.createElement('span');
        titleSpan.className = 'chat-item-title';
        titleSpan.textContent = item.title;
        titleSpan.title = item.title;

        itemEl.appendChild(iconDiv);
        itemEl.appendChild(titleSpan);

        if (item.pinned) {
          const pinBadge = document.createElement('span');
          pinBadge.className = 'chat-item-pin-badge';
          pinBadge.title = 'Pinned';
          pinBadge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"></path></svg>`;
          itemEl.appendChild(pinBadge);
        }

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'chat-item-actions';

        const pinBtn = document.createElement('button');
        pinBtn.className = 'item-action-btn pin-action-btn';
        pinBtn.title = item.pinned ? 'Unpin' : 'Pin';
        pinBtn.setAttribute('data-id', item.id);
        pinBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="${item.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"></path></svg>`;

        const renameBtn = document.createElement('button');
        renameBtn.className = 'item-action-btn rename-action-btn';
        renameBtn.title = 'Rename';
        renameBtn.setAttribute('data-id', item.id);
        renameBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;

        const exportBtn = document.createElement('button');
        exportBtn.className = 'item-action-btn export-action-btn';
        exportBtn.title = 'Export';
        exportBtn.setAttribute('data-id', item.id);
        exportBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'item-action-btn danger delete-action-btn';
        deleteBtn.title = 'Delete';
        deleteBtn.setAttribute('data-id', item.id);
        deleteBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

        actionsDiv.appendChild(pinBtn);
        actionsDiv.appendChild(renameBtn);
        actionsDiv.appendChild(exportBtn);
        actionsDiv.appendChild(deleteBtn);
        itemEl.appendChild(actionsDiv);

        list.appendChild(itemEl);
      }

      groupWrapper.appendChild(list);
      this.ui.historyContainer.appendChild(groupWrapper);
    };

    renderGroup('Pinned', grouped.pinned, true);
    renderGroup('Today', grouped.today);
    renderGroup('Yesterday', grouped.yesterday);
    renderGroup('Previous 7 Days', grouped.previous7Days);
    renderGroup('Older', grouped.older);
  }

  /**
   * Bind DOM event listeners
   */
  bindEvents() {
    // Send message on Send button click
    this.ui.sendBtn.addEventListener('click', () => {
      this.chat.sendMessage();
    });

    // Stop generation on Stop button click
    this.ui.stopBtn.addEventListener('click', () => {
      this.chat.stopGeneration();
    });

    // New Chat buttons
    const handleNewChat = () => {
      if (this.chat.isStreaming) {
        this.chat.stopGeneration();
      }

      const activeId = this.history.getActiveChatId();
      const currentConv = activeId ? this.history.getConversation(activeId) : null;

      // If current chat is already fresh and empty, just focus input
      if (currentConv && currentConv.messages.length === 0) {
        this.ui.chatInput.focus();
        this.ui.closeMobileSidebar();
        return;
      }

      const newConv = this.history.createConversation();
      this.renderSidebarHistory();
      this.chat.renderActiveConversation();
      this.ui.closeMobileSidebar();
      this.ui.chatInput.focus();
    };

    this.ui.newChatBtn.addEventListener('click', handleNewChat);
    this.ui.headerNewChatBtn.addEventListener('click', handleNewChat);

    // Sidebar conversation item clicks & actions (delegated)
    this.ui.historyContainer.addEventListener('click', (e) => {
      // Pin/unpin
      const pinBtn = e.target.closest('.pin-action-btn');
      if (pinBtn) {
        e.stopPropagation();
        const id = pinBtn.getAttribute('data-id');
        this.history.togglePin(id);
        this.renderSidebarHistory(this.ui.searchInput.value);
        return;
      }

      // Rename
      const renameBtn = e.target.closest('.rename-action-btn');
      if (renameBtn) {
        e.stopPropagation();
        const id = renameBtn.getAttribute('data-id');
        this.promptRenameConversation(id);
        return;
      }

      // Export individual chat
      const exportBtn = e.target.closest('.export-action-btn');
      if (exportBtn) {
        e.stopPropagation();
        const id = exportBtn.getAttribute('data-id');
        this.history.exportConversation(id, 'json');
        this.ui.showToast('Conversation exported as JSON', 'success');
        return;
      }

      // Delete individual chat
      const deleteBtn = e.target.closest('.delete-action-btn');
      if (deleteBtn) {
        e.stopPropagation();
        const id = deleteBtn.getAttribute('data-id');
        const conv = this.history.getConversation(id);
        this.ui.showConfirm({
          title: 'Delete Conversation',
          message: `Are you sure you want to delete "${conv ? conv.title : 'this chat'}"? This cannot be undone.`,
          confirmText: 'Delete',
          isDanger: true,
          onConfirm: () => {
            if (this.chat.isStreaming && id === this.history.getActiveChatId()) {
              this.chat.stopGeneration();
            }
            this.history.deleteConversation(id);
            this.renderSidebarHistory(this.ui.searchInput.value);
            this.chat.renderActiveConversation();
            this.ui.showToast('Conversation deleted.', 'info');
          }
        });
        return;
      }

      // Select conversation item
      const chatItem = e.target.closest('.chat-history-item');
      if (chatItem) {
        const id = chatItem.getAttribute('data-id');
        if (id === this.history.getActiveChatId()) return;

        if (this.chat.isStreaming) {
          this.chat.stopGeneration();
        }

        this.history.setActiveChatId(id);
        this.renderSidebarHistory(this.ui.searchInput.value);
        this.chat.renderActiveConversation();
        this.ui.closeMobileSidebar();
        this.ui.chatInput.focus();
      }
    });

    // Search conversations input with debounce
    let searchDebounceTimer = null;
    this.ui.searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      const query = this.ui.searchInput.value;
      if (this.ui.searchClearBtn) {
        this.ui.searchClearBtn.style.display = query ? 'block' : 'none';
      }
      searchDebounceTimer = setTimeout(() => {
        this.renderSidebarHistory(query);
      }, 150);
    });

    // Suggestion Cards on Welcome Screen
    const suggestionCards = document.querySelectorAll('.suggestion-card');
    suggestionCards.forEach(card => {
      card.addEventListener('click', () => {
        const prompt = card.getAttribute('data-prompt');
        if (prompt) {
          this.chat.sendMessage(prompt);
        }
      });
    });

    // Header Chat Title inline edit
    if (this.ui.currentChatTitleWrapper) {
      this.ui.currentChatTitleWrapper.addEventListener('click', () => {
        const activeId = this.history.getActiveChatId();
        if (activeId) {
          this.promptRenameConversation(activeId);
        }
      });
    }

    // Header Export current chat
    if (this.ui.headerExportBtn) {
      this.ui.headerExportBtn.addEventListener('click', () => {
        const activeId = this.history.getActiveChatId();
        if (!activeId) {
          this.ui.showToast('No active conversation to export', 'info');
          return;
        }
        this.history.exportConversation(activeId, 'txt');
        this.ui.showToast('Chat exported as TXT file', 'success');
      });
    }

    // Quick Theme Toggle on Header & Sidebar
    const cycleTheme = () => {
      const current = this.settings.get('theme');
      let next = 'dark';
      if (current === 'dark') next = 'light';
      else if (current === 'light') next = 'system';
      else next = 'dark';

      this.settings.saveSettings({ theme: next });
      this.ui.showToast(`Theme changed to ${next.toUpperCase()}`, 'info', 1500);
      this.updateThemeSettingsUI();
    };

    if (this.ui.headerThemeBtn) {
      this.ui.headerThemeBtn.addEventListener('click', cycleTheme);
    }
    const sidebarThemeBtn = document.getElementById('sidebar-theme-btn');
    if (sidebarThemeBtn) {
      sidebarThemeBtn.addEventListener('click', cycleTheme);
    }

    // Settings Modal Open
    if (this.ui.settingsBtn) {
      this.ui.settingsBtn.addEventListener('click', () => {
        this.updateApiKeyStatusIndicator();
        this.ui.openSettingsModal();
      });
    }

    // Keyboard Shortcuts Button
    const shortcutsBtn = document.getElementById('shortcuts-help-btn');
    if (shortcutsBtn) {
      shortcutsBtn.addEventListener('click', () => {
        this.ui.openShortcutsModal();
      });
    }

    // Clear All Conversations
    if (this.ui.clearAllBtn) {
      this.ui.clearAllBtn.addEventListener('click', () => {
        this.ui.showConfirm({
          title: 'Clear All Conversations',
          message: 'Are you sure you want to permanently delete all conversations? This action cannot be reversed.',
          confirmText: 'Clear All',
          isDanger: true,
          onConfirm: () => {
            this.history.clearAllConversations();
            this.renderSidebarHistory();
            this.chat.renderActiveConversation();
            this.ui.showToast('All chat history cleared.', 'info');
          }
        });
      });
    }

    // Settings Save and Change Events
    this.bindSettingsFormEvents();

    // Image Generation Mode & Lightbox Events
    this.bindImageModeEvents();
  }

  /**
   * Bind Image Generation UI Controls
   */
  bindImageModeEvents() {
    const toggleBtn = document.getElementById('toggle-image-mode-btn');
    const modeBar = document.getElementById('image-mode-bar');
    const closeBtn = document.getElementById('close-image-mode-btn');
    const ratioPills = document.querySelectorAll('.ratio-pill');
    const styleSelect = document.getElementById('image-style-select');
    const lightboxModal = document.getElementById('image-lightbox-modal');
    const lightboxClose = document.getElementById('lightbox-close-btn');

    const setImageMode = (active) => {
      this.chat.isImageMode = active;
      if (toggleBtn) {
        toggleBtn.classList.toggle('active', active);
        toggleBtn.title = active ? 'Exit Image Mode' : 'Create AI Image (Alt+I)';
      }
      if (modeBar) {
        modeBar.style.display = active ? 'flex' : 'none';
      }
      if (this.ui.chatInput) {
        this.ui.chatInput.placeholder = active
          ? 'Describe the image you want to generate with AI...'
          : 'Message NexoAI or type /image to generate artwork...';
        this.ui.chatInput.focus();
      }
    };

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        setImageMode(!this.chat.isImageMode);
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        setImageMode(false);
      });
    }

    ratioPills.forEach(pill => {
      pill.addEventListener('click', () => {
        ratioPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const ratio = pill.getAttribute('data-ratio') || '1:1';
        this.chat.selectedAspectRatio = ratio;
      });
    });

    if (styleSelect) {
      styleSelect.addEventListener('change', () => {
        this.chat.selectedImageStyle = styleSelect.value;
      });
    }

    if (lightboxClose) {
      lightboxClose.addEventListener('click', () => {
        this.chat.closeLightbox();
      });
    }

    if (lightboxModal) {
      lightboxModal.addEventListener('click', (e) => {
        if (e.target === lightboxModal) {
          this.chat.closeLightbox();
        }
      });
    }
  }

  /**
   * Prompt to rename a conversation
   */
  promptRenameConversation(id) {
    const conv = this.history.getConversation(id);
    if (!conv) return;

    const newTitle = prompt('Enter new conversation title:', conv.title);
    if (newTitle !== null && newTitle.trim()) {
      this.history.renameConversation(id, newTitle.trim());
      this.renderSidebarHistory(this.ui.searchInput.value);
      if (this.history.getActiveChatId() === id) {
        this.ui.setCurrentChatTitle(newTitle.trim());
      }
      this.ui.showToast('Conversation renamed', 'success');
    }
  }

  /**
   * Bind global keyboard shortcuts
   */
  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Enter to send (without Shift) when textarea is focused
      if (e.key === 'Enter' && !e.shiftKey && document.activeElement === this.ui.chatInput) {
        e.preventDefault();
        this.chat.sendMessage();
        return;
      }

      // Alt + I -> Toggle Image Mode
      if (e.altKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        const toggleBtn = document.getElementById('toggle-image-mode-btn');
        if (toggleBtn) toggleBtn.click();
        return;
      }

      // Escape to close modals or stop generation
      if (e.key === 'Escape') {
        const lightboxModal = document.getElementById('image-lightbox-modal');
        if (lightboxModal?.classList.contains('active')) {
          this.chat.closeLightbox();
          return;
        }
        if (this.ui.confirmModal?.classList.contains('active')) {
          this.ui.confirmModal.classList.remove('active');
          return;
        }
        if (this.ui.settingsModal?.classList.contains('active')) {
          this.ui.closeSettingsModal();
          return;
        }
        if (this.ui.shortcutsModal?.classList.contains('active')) {
          this.ui.closeShortcutsModal();
          return;
        }
        if (this.chat.isStreaming || this.chat.isGeneratingImage) {
          this.chat.stopGeneration();
          return;
        }
      }

      // Ctrl / Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        // Ctrl + K -> New Chat
        if (e.key === 'k' || e.key === 'K') {
          e.preventDefault();
          this.ui.newChatBtn.click();
          return;
        }

        // Ctrl + B -> Toggle Sidebar
        if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          this.ui.toggleSidebar();
          return;
        }

        // Ctrl + / -> Shortcuts Cheat Sheet
        if (e.key === '/') {
          e.preventDefault();
          this.ui.openShortcutsModal();
          return;
        }
      }
    });
  }

  /**
   * Settings Modal inputs and form handlers
   */
  initSettingsModalValues() {
    this.updateThemeSettingsUI();

    const modelSelect = document.getElementById('setting-model');
    if (modelSelect) {
      modelSelect.value = this.settings.get('model') || 'gemini-2.5-flash';
    }

    const contextLimitSelect = document.getElementById('setting-context-limit');
    if (contextLimitSelect) {
      contextLimitSelect.value = String(this.settings.get('contextLimit') || 20);
    }

    const customKeyInput = document.getElementById('setting-custom-key');
    if (customKeyInput) {
      customKeyInput.value = this.settings.get('customApiKey') || '';
    }

    const systemPromptInput = document.getElementById('setting-system-prompt');
    if (systemPromptInput) {
      systemPromptInput.value = this.settings.get('customSystemPrompt') || '';
    }
  }

  updateThemeSettingsUI() {
    const currentTheme = this.settings.get('theme');
    const cards = document.querySelectorAll('.theme-option-card');
    cards.forEach(card => {
      const cardTheme = card.getAttribute('data-theme');
      card.classList.toggle('active', cardTheme === currentTheme);
    });
  }

  bindSettingsFormEvents() {
    // Theme options cards
    const themeCards = document.querySelectorAll('.theme-option-card');
    themeCards.forEach(card => {
      card.addEventListener('click', () => {
        const theme = card.getAttribute('data-theme');
        this.settings.saveSettings({ theme });
        this.updateThemeSettingsUI();
        this.ui.showToast(`Applied ${theme} theme`, 'info', 1500);
      });
    });

    // Model selection
    const modelSelect = document.getElementById('setting-model');
    if (modelSelect) {
      modelSelect.addEventListener('change', () => {
        this.settings.saveSettings({ model: modelSelect.value });
        this.ui.showToast(`Model set to ${modelSelect.value}`, 'success');
      });
    }

    // Context limit
    const contextLimitSelect = document.getElementById('setting-context-limit');
    if (contextLimitSelect) {
      contextLimitSelect.addEventListener('change', () => {
        this.settings.saveSettings({ contextLimit: parseInt(contextLimitSelect.value, 10) });
        this.ui.showToast('Context limit updated', 'success');
      });
    }

    // Custom API Key (Session Only)
    const customKeyInput = document.getElementById('setting-custom-key');
    const saveKeyBtn = document.getElementById('save-key-btn');
    const clearKeyBtn = document.getElementById('clear-key-btn');
    if (saveKeyBtn && customKeyInput) {
      saveKeyBtn.addEventListener('click', () => {
        const val = customKeyInput.value.trim();
        this.settings.saveSettings({ customApiKey: val });
        this.updateApiKeyStatusIndicator();
        this.ui.showToast(val ? 'Session key saved (memory only)' : 'Key cleared, using server default', 'success');
      });
    }
    if (clearKeyBtn && customKeyInput) {
      clearKeyBtn.addEventListener('click', () => {
        customKeyInput.value = '';
        this.settings.saveSettings({ customApiKey: '' });
        this.updateApiKeyStatusIndicator();
        this.ui.showToast('Session key cleared. Using server default.', 'info');
      });
    }

    // Custom System Prompt
    const systemPromptInput = document.getElementById('setting-system-prompt');
    const savePromptBtn = document.getElementById('save-prompt-btn');
    if (savePromptBtn && systemPromptInput) {
      savePromptBtn.addEventListener('click', () => {
        this.settings.saveSettings({ customSystemPrompt: systemPromptInput.value.trim() });
        this.ui.showToast('Custom instructions saved', 'success');
      });
    }

    // Export all data
    const exportAllBtn = document.getElementById('export-all-data-btn');
    if (exportAllBtn) {
      exportAllBtn.addEventListener('click', () => {
        const allConvs = this.history.getAllConversations();
        const blob = new Blob([JSON.stringify(allConvs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NexoAI_All_Chats_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.ui.showToast('All conversations exported', 'success');
      });
    }

    // Import data file input
    const importInput = document.getElementById('import-data-file');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
          this.ui.showToast('Import failed: File exceeds 2MB limit.', 'error', 4000);
          importInput.value = '';
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const content = event.target.result;
            const count = this.history.importConversations(content);
            this.ui.showToast(`Imported ${count} conversation${count > 1 ? 's' : ''} successfully`, 'success');
            this.renderSidebarHistory();
            this.chat.renderActiveConversation();
            this.ui.closeSettingsModal();
          } catch (err) {
            this.ui.showToast(err.message, 'error', 4500);
          } finally {
            importInput.value = '';
          }
        };
        reader.onerror = () => {
          this.ui.showToast('Failed to read the selected file.', 'error', 3000);
          importInput.value = '';
        };
        reader.readAsText(file);
      });
    }
  }
}

// Bootstrap application once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.nexoApp = new NexoApp();
});
