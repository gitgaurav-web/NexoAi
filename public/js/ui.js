/**
 * NexoAI - UI Controller
 * Manages DOM interaction, sidebar state, modals, toasts, auto-resize input, and scroll buttons.
 */

export class UIController {
  constructor() {
    this.initElements();
    this.bindCoreEvents();
  }

  /**
   * Cache critical DOM elements
   */
  initElements() {
    this.sidebar = document.getElementById('sidebar');
    this.sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    this.mobileMenuBtn = document.getElementById('mobile-menu-btn');
    this.sidebarBackdrop = document.getElementById('sidebar-backdrop');

    this.newChatBtn = document.getElementById('new-chat-btn');
    this.headerNewChatBtn = document.getElementById('header-new-chat-btn');
    this.searchInput = document.getElementById('search-input');
    this.searchClearBtn = document.getElementById('search-clear-btn');
    this.historyContainer = document.getElementById('history-container');

    this.currentChatTitleEl = document.getElementById('current-chat-title');
    this.currentChatTitleWrapper = document.getElementById('current-chat-title-wrapper');
    this.headerExportBtn = document.getElementById('header-export-btn');
    this.headerThemeBtn = document.getElementById('header-theme-btn');

    this.messagesContainer = document.getElementById('messages-container');
    this.messagesInner = document.getElementById('messages-inner');
    this.welcomeScreen = document.getElementById('welcome-screen');
    this.scrollBottomBtn = document.getElementById('scroll-bottom-btn');

    this.chatInput = document.getElementById('chat-input');
    this.sendBtn = document.getElementById('send-btn');
    this.stopBtn = document.getElementById('stop-btn');
    this.charCounter = document.getElementById('char-counter');

    // Modals
    this.settingsModal = document.getElementById('settings-modal');
    this.settingsBtn = document.getElementById('settings-btn');
    this.settingsCloseBtn = document.getElementById('settings-close-btn');

    this.confirmModal = document.getElementById('confirm-modal');
    this.confirmTitle = document.getElementById('confirm-title');
    this.confirmMessage = document.getElementById('confirm-message');
    this.confirmOkBtn = document.getElementById('confirm-ok-btn');
    this.confirmCancelBtn = document.getElementById('confirm-cancel-btn');

    this.shortcutsModal = document.getElementById('shortcuts-modal');
    this.shortcutsCloseBtn = document.getElementById('shortcuts-close-btn');

    this.toastContainer = document.getElementById('toast-container');
    this.clearAllBtn = document.getElementById('clear-all-btn');
  }

  /**
   * Core UI bindings for layout and viewport
   */
  bindCoreEvents() {
    // Desktop sidebar expand/collapse toggle
    if (this.sidebarToggleBtn) {
      this.sidebarToggleBtn.addEventListener('click', () => {
        this.toggleSidebar();
      });
    }

    // Mobile sidebar hamburger toggle
    if (this.mobileMenuBtn) {
      this.mobileMenuBtn.addEventListener('click', () => {
        this.openMobileSidebar();
      });
    }

    // Close mobile drawer when backdrop is clicked
    if (this.sidebarBackdrop) {
      this.sidebarBackdrop.addEventListener('click', () => {
        this.closeMobileSidebar();
      });
    }

    // Auto-expanding textarea and char count
    if (this.chatInput) {
      this.chatInput.addEventListener('input', () => {
        this.handleInputResize();
        this.updateCharCounter();
        this.updateSendButtonState();
      });
    }

    // Messages container scroll listener for floating scroll-to-bottom button
    if (this.messagesContainer) {
      this.messagesContainer.addEventListener('scroll', () => {
        this.handleScroll();
      });
    }

    // Floating scroll to bottom click
    if (this.scrollBottomBtn) {
      this.scrollBottomBtn.addEventListener('click', () => {
        this.scrollToBottom(true);
      });
    }

    // Search input clear button
    if (this.searchClearBtn && this.searchInput) {
      this.searchClearBtn.addEventListener('click', () => {
        this.searchInput.value = '';
        this.searchClearBtn.style.display = 'none';
        this.searchInput.dispatchEvent(new Event('input'));
        this.searchInput.focus();
      });
    }

    // Modal close buttons
    if (this.settingsCloseBtn) {
      this.settingsCloseBtn.addEventListener('click', () => this.closeSettingsModal());
    }
    if (this.shortcutsCloseBtn) {
      this.shortcutsCloseBtn.addEventListener('click', () => this.closeShortcutsModal());
    }
  }

  /**
   * Toggle desktop sidebar or mobile drawer
   */
  toggleSidebar() {
    if (window.innerWidth <= 768) {
      if (this.sidebar.classList.contains('open')) {
        this.closeMobileSidebar();
      } else {
        this.openMobileSidebar();
      }
    } else {
      this.sidebar.classList.toggle('collapsed');
      // Save desktop preference
      const isCollapsed = this.sidebar.classList.contains('collapsed');
      localStorage.setItem('nexo_sidebar_collapsed', isCollapsed ? 'true' : 'false');
    }
  }

  openMobileSidebar() {
    this.sidebar.classList.add('open');
    if (this.sidebarBackdrop) {
      this.sidebarBackdrop.classList.add('active');
    }
  }

  closeMobileSidebar() {
    this.sidebar.classList.remove('open');
    if (this.sidebarBackdrop) {
      this.sidebarBackdrop.classList.remove('active');
    }
  }

  /**
   * Auto-adjust textarea height to content up to 180px
   */
  handleInputResize() {
    if (!this.chatInput) return;
    this.chatInput.style.height = 'auto';
    const newHeight = Math.min(this.chatInput.scrollHeight, 180);
    this.chatInput.style.height = `${Math.max(newHeight, 24)}px`;
  }

  resetInputHeight() {
    if (!this.chatInput) return;
    this.chatInput.style.height = 'auto';
  }

  updateCharCounter() {
    if (!this.charCounter || !this.chatInput) return;
    const len = this.chatInput.value.length;
    if (len > 0) {
      this.charCounter.textContent = `${len.toLocaleString()}`;
      this.charCounter.style.display = 'block';
    } else {
      this.charCounter.style.display = 'none';
    }
  }

  updateSendButtonState() {
    if (!this.sendBtn || !this.chatInput) return;
    const hasText = this.chatInput.value.trim().length > 0;
    this.sendBtn.disabled = !hasText;
  }

  /**
   * Check scroll position and show/hide scroll-to-bottom button
   */
  handleScroll() {
    if (!this.messagesContainer || !this.scrollBottomBtn) return;
    const threshold = 120;
    const distanceToBottom =
      this.messagesContainer.scrollHeight -
      this.messagesContainer.scrollTop -
      this.messagesContainer.clientHeight;

    if (distanceToBottom > threshold) {
      this.scrollBottomBtn.classList.add('visible');
    } else {
      this.scrollBottomBtn.classList.remove('visible');
    }
  }

  /**
   * Scroll viewport to bottom
   */
  scrollToBottom(smooth = true) {
    if (!this.messagesContainer) return;
    this.messagesContainer.scrollTo({
      top: this.messagesContainer.scrollHeight,
      behavior: smooth ? 'smooth' : 'instant'
    });
  }

  /**
   * Update header chat title display
   */
  setCurrentChatTitle(title) {
    if (this.currentChatTitleEl) {
      this.currentChatTitleEl.textContent = title || 'NexoAI';
    }
  }

  /**
   * Toggle between Welcome screen and Messages list
   */
  toggleWelcomeScreen(showWelcome) {
    if (this.welcomeScreen) {
      this.welcomeScreen.style.display = showWelcome ? 'flex' : 'none';
    }
  }

  /**
   * Switch input button state: Sending vs Generating (Stop)
   */
  setGeneratingState(isGenerating) {
    if (isGenerating) {
      this.sendBtn.style.display = 'none';
      this.stopBtn.style.display = 'flex';
      this.chatInput.disabled = true;
    } else {
      this.stopBtn.style.display = 'none';
      this.sendBtn.style.display = 'flex';
      this.chatInput.disabled = false;
      this.chatInput.focus();
      this.updateSendButtonState();
    }
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info', duration = 3200) {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    const iconDiv = document.createElement('div');
    iconDiv.className = 'toast-icon';
    iconDiv.innerHTML = iconSvg;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'toast-msg';
    msgDiv.textContent = message;

    toast.appendChild(iconDiv);
    toast.appendChild(msgDiv);

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 200);
    }, duration);
  }

  /**
   * Show custom confirmation modal
   */
  showConfirm({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', isDanger = false, onConfirm }) {
    if (!this.confirmModal) return;

    this.confirmTitle.textContent = title || 'Confirm Action';
    this.confirmMessage.textContent = message || 'Are you sure you want to proceed?';
    this.confirmOkBtn.textContent = confirmText;
    this.confirmCancelBtn.textContent = cancelText;

    if (isDanger) {
      this.confirmOkBtn.className = 'btn btn-danger';
    } else {
      this.confirmOkBtn.className = 'btn btn-primary';
    }

    this.confirmModal.classList.add('active');

    const cleanup = () => {
      this.confirmModal.classList.remove('active');
      this.confirmOkBtn.onclick = null;
      this.confirmCancelBtn.onclick = null;
    };

    this.confirmOkBtn.onclick = () => {
      cleanup();
      if (typeof onConfirm === 'function') onConfirm();
    };

    this.confirmCancelBtn.onclick = () => {
      cleanup();
    };
  }

  /**
   * Open / Close Settings Modal
   */
  openSettingsModal() {
    if (this.settingsModal) {
      this.settingsModal.classList.add('active');
    }
  }

  closeSettingsModal() {
    if (this.settingsModal) {
      this.settingsModal.classList.remove('active');
    }
  }

  /**
   * Open / Close Shortcuts Modal
   */
  openShortcutsModal() {
    if (this.shortcutsModal) {
      this.shortcutsModal.classList.add('active');
    }
  }

  closeShortcutsModal() {
    if (this.shortcutsModal) {
      this.shortcutsModal.classList.remove('active');
    }
  }

  /**
   * Format human friendly relative timestamp
   */
  static formatTimestamp(isoString) {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }
}
