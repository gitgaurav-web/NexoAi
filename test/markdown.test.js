import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MarkdownRenderer } from '../public/js/markdown.js';

describe('MarkdownRenderer', () => {
  describe('escapeHtml', () => {
    test('escapes HTML special characters to prevent XSS injection', () => {
      const unsafe = '<script>alert("XSS & hack")</script>\'test\'';
      const safe = MarkdownRenderer.escapeHtml(unsafe);
      assert.equal(safe, '&lt;script&gt;alert(&quot;XSS &amp; hack&quot;)&lt;/script&gt;&#039;test&#039;');
      assert.ok(!safe.includes('<script>'));
    });

    test('handles empty and null values gracefully', () => {
      assert.equal(MarkdownRenderer.escapeHtml(''), '');
      assert.equal(MarkdownRenderer.escapeHtml(null), '');
      assert.equal(MarkdownRenderer.escapeHtml(undefined), '');
    });
  });

  describe('sanitizeUrl', () => {
    test('allows safe http and https protocols', () => {
      assert.equal(MarkdownRenderer.sanitizeUrl('https://example.com/api'), 'https://example.com/api');
      assert.equal(MarkdownRenderer.sanitizeUrl('http://localhost:3000'), 'http://localhost:3000');
      assert.equal(MarkdownRenderer.sanitizeUrl('mailto:test@example.com'), 'mailto:test@example.com');
    });

    test('blocks dangerous javascript: and data: protocols', () => {
      assert.equal(MarkdownRenderer.sanitizeUrl('javascript:alert(1)'), '#');
      assert.equal(MarkdownRenderer.sanitizeUrl('data:text/html,<script>alert(1)</script>'), '#');
      assert.equal(MarkdownRenderer.sanitizeUrl('vbscript:msgbox("hello")'), '#');
    });
  });

  describe('render markdown formatting', () => {
    test('renders headings correctly', () => {
      const md = '# Header 1\n## Header 2\n### Header 3';
      const rendered = MarkdownRenderer.render(md);
      assert.ok(rendered.includes('<h1>Header 1</h1>'));
      assert.ok(rendered.includes('<h2>Header 2</h2>'));
      assert.ok(rendered.includes('<h3>Header 3</h3>'));
    });

    test('renders bold, italics, and inline code', () => {
      const md = 'This is **bold**, this is *italic*, and `const x = 10;`.';
      const rendered = MarkdownRenderer.render(md);
      assert.ok(rendered.includes('<strong>bold</strong>'));
      assert.ok(rendered.includes('<em>italic</em>'));
      assert.ok(rendered.includes('<code>const x = 10;</code>'));
    });

    test('renders fenced code blocks into dark code cards with language and copy button', () => {
      const md = '```javascript\nconsole.log("hello world");\n```';
      const rendered = MarkdownRenderer.render(md);
      assert.ok(rendered.includes('class="code-card"'));
      assert.ok(rendered.includes('class="code-lang-label"'));
      assert.ok(rendered.includes('JavaScript'));
      assert.ok(rendered.includes('class="copy-code-btn"'));
      assert.ok(rendered.includes('console.log(&quot;hello world&quot;);'));
    });

    test('renders lists correctly', () => {
      const md = '- Item A\n- Item B\n- Item C';
      const rendered = MarkdownRenderer.render(md);
      assert.ok(rendered.includes('<ul>'));
      assert.ok(rendered.includes('<li>Item A</li>'));
      assert.ok(rendered.includes('<li>Item B</li>'));
      assert.ok(rendered.includes('<li>Item C</li>'));
      assert.ok(rendered.includes('</ul>'));
    });

    test('renders markdown links securely with rel="noopener noreferrer"', () => {
      const md = '[Google](https://google.com)';
      const rendered = MarkdownRenderer.render(md);
      assert.ok(rendered.includes('href="https://google.com"'));
      assert.ok(rendered.includes('target="_blank"'));
      assert.ok(rendered.includes('rel="noopener noreferrer"'));
    });

    test('neutralizes malicious markdown links with javascript: href', () => {
      const md = '[Click me](javascript:alert("XSS"))';
      const rendered = MarkdownRenderer.render(md);
      assert.ok(!rendered.includes('href="javascript:'));
      assert.ok(rendered.includes('href="#"'));
    });

    test('handles code placeholder tokens without collision with italics or bold', () => {
      const md = 'Code example:\n```python\n_var_name = 42\n```\nAnd italic text *here*.';
      const rendered = MarkdownRenderer.render(md);
      assert.ok(rendered.includes('class="code-card"'));
      assert.ok(rendered.includes('_var_name = 42'));
      assert.ok(!rendered.includes('%%NEXOCODEBLOCK'));
    });
  });
});
