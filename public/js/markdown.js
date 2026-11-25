/**
 * NexoAI - Safe Markdown & Code Renderer
 * Parses Markdown with XSS prevention and formats dark code cards with copy functionality.
 */

export class MarkdownRenderer {
  /**
   * Escape HTML entities to prevent XSS vulnerabilities
   */
  static escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Sanitize URLs to allow only safe protocols
   */
  static sanitizeUrl(url) {
    if (!url) return '#';
    const trimmed = url.trim();
    if (/^(https?:\/\/|mailto:)/i.test(trimmed)) {
      return trimmed;
    }
    return '#';
  }

  /**
   * Format code language display label
   */
  static formatLanguage(lang) {
    if (!lang) return 'Code';
    const map = {
      js: 'JavaScript',
      javascript: 'JavaScript',
      ts: 'TypeScript',
      typescript: 'TypeScript',
      py: 'Python',
      python: 'Python',
      html: 'HTML',
      css: 'CSS',
      scss: 'SCSS',
      sql: 'SQL',
      json: 'JSON',
      java: 'Java',
      c: 'C',
      cpp: 'C++',
      'c++': 'C++',
      cs: 'C#',
      'c#': 'C#',
      php: 'PHP',
      rb: 'Ruby',
      ruby: 'Ruby',
      go: 'Go',
      rust: 'Rust',
      rs: 'Rust',
      sh: 'Bash',
      bash: 'Bash',
      shell: 'Shell',
      zsh: 'Zsh',
      powershell: 'PowerShell',
      yaml: 'YAML',
      yml: 'YAML',
      xml: 'XML',
      markdown: 'Markdown',
      md: 'Markdown',
      diff: 'Diff'
    };
    const key = lang.trim().toLowerCase();
    return map[key] || lang.charAt(0).toUpperCase() + lang.slice(1);
  }

  /**
   * Parse Markdown text into sanitized HTML
   * @param {string} rawMarkdown - The raw input text
   * @param {boolean} isStreaming - True if currently receiving SSE stream chunks
   * @returns {string} Sanitized HTML output
   */
  static render(rawMarkdown, isStreaming = false) {
    if (!rawMarkdown) return '';

    let text = rawMarkdown;

    // Handle unclosed code blocks during streaming
    if (isStreaming) {
      const fenceCount = (text.match(/```/g) || []).length;
      if (fenceCount % 2 !== 0) {
        text += '\n```';
      }
    }

    // Temporary placeholder storage for code blocks to prevent inner markdown parsing
    const codeBlocks = [];

    // 1. Extract fenced code blocks
    text = text.replace(/```([a-zA-Z0-9_\-+]*)\n?([\s\S]*?)```/g, (match, lang, code) => {
      const cleanLang = (lang || '').trim();
      const displayLang = this.formatLanguage(cleanLang);
      const escapedCode = this.escapeHtml(code.replace(/\n$/, ''));
      const blockId = `%%NEXOCODEBLOCK${codeBlocks.length}%%`;

      const cardHtml = `
<div class="code-card">
  <div class="code-card-header">
    <span class="code-lang-label">${this.escapeHtml(displayLang)}</span>
    <button class="copy-code-btn" type="button" data-code="${encodeURIComponent(code.replace(/\n$/, ''))}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>Copy Code</span>
    </button>
  </div>
  <pre><code class="language-${this.escapeHtml(cleanLang)}">${escapedCode}</code></pre>
</div>`;

      codeBlocks.push(cardHtml);
      return `\n\n${blockId}\n\n`;
    });

    // 2. Escape HTML for the rest of markdown content
    text = this.escapeHtml(text);

    // 3. Inline code blocks (`code`)
    text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // 4. Headings (# h1 to #### h4)
    text = text.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // 5. Horizontal rules
    text = text.replace(/^---$/gim, '<hr>');

    // 6. Blockquotes
    text = text.replace(/^\&gt;\s?(.*$)/gim, '<blockquote>$1</blockquote>');
    text = text.replace(/<\/blockquote>\s*<blockquote>/g, '<br>');

    // 7. Bold, Italic, Strikethrough
    text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/_(.*?)_/g, '<em>$1</em>');
    text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');

    // 8. Markdown Tables
    text = text.replace(/((?:\|[^\n]+\|\r?\n)+)/g, (tableBlock) => {
      const rows = tableBlock.trim().split(/\r?\n/).map(r => r.trim()).filter(Boolean);
      if (rows.length < 2) return tableBlock;

      const isTable = /^\|?(\s*:?-+:?\s*\|)+\s*$/.test(rows[1]);
      if (!isTable) return tableBlock;

      let html = '<table>';
      const headerCells = rows[0].split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      html += '<thead><tr>';
      for (const cell of headerCells) {
        html += `<th>${cell}</th>`;
      }
      html += '</tr></thead><tbody>';

      for (let i = 2; i < rows.length; i++) {
        const cells = rows[i].split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        html += '<tr>';
        for (const cell of cells) {
          html += `<td>${cell}</td>`;
        }
        html += '</tr>';
      }
      html += '</tbody></table>';
      return html;
    });

    // 9. Links: [text](url) - supports nested parens and attribute escaping
    text = text.replace(/\[([^\]]+)\]\(((?:[^()]+|\([^()]+\))+)\)/g, (match, linkText, url) => {
      const safeUrl = this.escapeHtml(this.sanitizeUrl(url));
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    });

    // 10. Unordered Lists
    text = text.replace(/(?:^[ \t]*[\*\-]\s+(.*(?:\r?\n|$)))+/gm, (listBlock) => {
      const items = listBlock.trim().split(/\r?\n/);
      const listHtml = items.map(item => {
        const content = item.replace(/^[ \t]*[\*\-]\s+/, '');
        return `<li>${content}</li>`;
      }).join('');
      return `<ul>${listHtml}</ul>`;
    });

    // 11. Ordered Lists
    text = text.replace(/(?:^[ \t]*\d+\.\s+(.*(?:\r?\n|$)))+/gm, (listBlock) => {
      const items = listBlock.trim().split(/\r?\n/);
      const listHtml = items.map(item => {
        const content = item.replace(/^[ \t]*\d+\.\s+/, '');
        return `<li>${content}</li>`;
      }).join('');
      return `<ol>${listHtml}</ol>`;
    });

    // 12. Paragraphs & line breaks
    const chunks = text.split(/\n\n+/);
    text = chunks.map(chunk => {
      const trimmed = chunk.trim();
      if (!trimmed) return '';
      if (/^(%%NEXOCODEBLOCK\d+%%|<(h[1-4]|table|ul|ol|blockquote|hr))/i.test(trimmed)) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).join('\n\n');

    // 13. Restore code blocks
    for (let i = 0; i < codeBlocks.length; i++) {
      text = text.replace(`%%NEXOCODEBLOCK${i}%%`, codeBlocks[i]);
    }

    return text;
  }
}
