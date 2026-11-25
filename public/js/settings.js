/**
 * NexoAI - Settings & Theme Manager
 * Manages themes (Dark, Light, System) and user preferences with LocalStorage.
 * Sensitive keys (e.g., custom API key) are stored strictly in sessionStorage (in-memory per tab)
 * and are never persisted to permanent disk localStorage.
 */

export class SettingsManager {
  static STORAGE_KEY = 'nexo_settings';
  static LEGACY_STORAGE_KEY = 'nova_settings';
  static SESSION_KEY_NAME = 'nexo_session_api_key';

  constructor() {
    this.settings = this.loadSettings();
    this.purgeInsecureStorage();
    this.initSystemThemeListener();
    this.applyTheme(this.settings.theme);
  }

  /**
   * Purge any legacy API keys that may have been stored in localStorage previously
   */
  purgeInsecureStorage() {
    try {
      const raw = localStorage.getItem(SettingsManager.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.customApiKey) {
          delete parsed.customApiKey;
          localStorage.setItem(SettingsManager.STORAGE_KEY, JSON.stringify(parsed));
        }
      }
      localStorage.removeItem('customApiKey');
      localStorage.removeItem('gemini_api_key');
    } catch {
      // Ignore cleanup error
    }
  }

  /**
   * Load saved settings or fallback to defaults
   */
  loadSettings() {
    const defaults = {
      theme: 'dark', // 'dark' | 'light' | 'system'
      model: 'gemini-2.5-flash',
      contextLimit: 20,
      customSystemPrompt: ''
    };

    try {
      const raw = localStorage.getItem(SettingsManager.STORAGE_KEY) ||
                  localStorage.getItem(SettingsManager.LEGACY_STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      // Ensure customApiKey is not loaded from localStorage
      delete parsed.customApiKey;
      return Object.assign(defaults, parsed);
    } catch (e) {
      console.warn('Failed to parse settings, using defaults', e);
      return defaults;
    }
  }

  /**
   * Save settings safely (only non-sensitive preferences go to localStorage)
   */
  saveSettings(newSettings = {}) {
    // If user provided a session key, store strictly in sessionStorage
    if ('customApiKey' in newSettings) {
      const keyVal = (newSettings.customApiKey || '').trim();
      try {
        if (keyVal) {
          sessionStorage.setItem(SettingsManager.SESSION_KEY_NAME, keyVal);
        } else {
          sessionStorage.removeItem(SettingsManager.SESSION_KEY_NAME);
        }
      } catch (err) {
        console.warn('SessionStorage unavailable for API key:', err);
      }
    }

    // Clone settings without sensitive keys for permanent storage
    const safeToPersist = { ...this.settings, ...newSettings };
    delete safeToPersist.customApiKey;

    Object.assign(this.settings, safeToPersist);

    try {
      localStorage.setItem(SettingsManager.STORAGE_KEY, JSON.stringify(safeToPersist));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }

    if (newSettings.theme) {
      this.applyTheme(newSettings.theme);
    }
  }

  /**
   * Get specific setting. Sensitive keys come from sessionStorage.
   */
  get(key) {
    if (key === 'customApiKey') {
      try {
        return sessionStorage.getItem(SettingsManager.SESSION_KEY_NAME) || '';
      } catch {
        return '';
      }
    }
    return this.settings[key];
  }

  /**
   * Apply selected theme to document
   */
  applyTheme(theme) {
    const doc = document.documentElement;
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      doc.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      doc.setAttribute('data-theme', theme || 'dark');
    }
  }

  /**
   * Listen to OS color scheme changes when system theme is active
   */
  initSystemThemeListener() {
    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (e) => {
        if (this.settings.theme === 'system') {
          document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
      });
    } catch {
      // Fallback
    }
  }
}
