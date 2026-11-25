# NexoAI – Advanced AI Chatbot Web Application

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.21+-blue.svg)](https://expressjs.com)
[![Google Gen AI](https://img.shields.io/badge/Google%20Gen%20AI-Official%20SDK-orange.svg)](https://www.npmjs.com/package/@google/genai)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

A modern, production-grade, full-stack AI chatbot web application inspired by ChatGPT and Google Gemini. Powered by the official Google Gemini `@google/genai` SDK with real-time Server-Sent Events (SSE) streaming, typewriter pacing, rich markdown and dark code cards, LocalStorage multi-chat management, dark/light/system themes, and responsive design across desktop, tablet, and mobile.

Built cleanly with vanilla HTML5, CSS3, and ES6+ JavaScript on the frontend (no heavy React/Next.js/Tailwind bloat) and an Express.js backend.

---

## 🌟 Highlights & Features

### 1. Modern ChatGPT & Gemini-Inspired Interface
- **Floating Input Bar:** Glassmorphism floating pill container with auto-expanding textarea, character counter, send button, and stop generation controls.
- **Dynamic Welcome Screen:** Animated NexoAI glowing gradient avatar, greeting, and 4 interactive prompt suggestion cards (Writing, Concept Explanation, Code Generation, Brainstorming).
- **Smooth Auto-Scroll:** Intelligently scrolls to new tokens during streaming, plus a floating **Scroll-to-Bottom** button when reviewing earlier messages.
- **Collapsible Sidebar:** Fully responsive sidebar with smooth collapse on desktop and touch-friendly slide-over drawer with backdrop on mobile.

### 2. Real-Time Streaming & AI Intelligence
- **Official `@google/genai` SDK:** Built with the latest unified Google Gen AI SDK.
- **Server-Sent Events (SSE):** Real-time chunk-by-chunk streaming over standard HTTP connections.
- **Fluid Typewriter Pacing:** Smooth client-side token buffering (~18ms pacing) for a natural, authentic AI typing sensation.
- **Stop Generation:** Abort active responses on demand using `AbortController` while safely preserving all partial text.
- **Multi-Turn Context:** Retains multi-turn conversation memory with configurable turn limits to balance speed and context depth.
- **Professional System Persona:** Pre-configured persona for accurate, well-structured answers with code fences, admitting uncertainty honestly and clarifying text-only capabilities.

### 3. AI Image Generation (FLUX.1 Diffusion Engine)
- **High-Definition Synthesis:** Create photorealistic images and digital artwork directly from text prompts using the FLUX.1 diffusion engine.
- **Dedicated Image Mode Bar:** Toggle Image Mode with the floating 🖼️ button or `Alt + I` shortcut.
- **Aspect Ratio Controls:** 1-click pills for Square (`1:1`), Landscape (`16:9`), and Portrait (`9:16`).
- **Art Style Presets:** Cinematic, Photorealistic, Anime / Manga, Digital Art, Cyberpunk, and Minimalist.
- **Smart Intent Detection:** Automatically routes `/image <prompt>` and `generate an image of ...` to the diffusion engine.
- **Interactive Image Cards:** Shimmer skeleton loading state, provider metadata badge, Zoom (Fullscreen Lightbox preview), and 1-click HD Download.
- **Chat History Persistence:** All generated images are persisted with metadata in LocalStorage.

### 4. Rich Markdown & Syntax-Highlighted Code Cards
- **Dark Code-Card Interface:** Formats fenced Markdown code into sleek dark cards with language identification labels (Python, JavaScript, TypeScript, HTML, CSS, C++, Java, SQL, PHP, JSON, Bash, Go, Rust, etc.).
- **One-Click Code Copy:** Dedicated "Copy Code" button with temporary checkmark and toast feedback.
- **XSS Security:** Strict HTML entity escaping and URL scheme sanitization to prevent arbitrary HTML or script injection from model outputs.
- **Markdown Support:** Headings, blockquotes, bold/italic/strikethrough text, ordered/unordered lists, markdown tables, and safe external links (`target="_blank" rel="noopener noreferrer"`).

### 5. Robust Multi-Chat Management (LocalStorage)
- **Automatic Titling:** Generates concise titles based on your initial message.
- **Chronological Grouping:** Chats organized into **Pinned**, **Today**, **Yesterday**, **Previous 7 Days**, and **Older**.
- **Per-Chat Actions:** Pin/Unpin, Rename, Export, and Delete with custom modal confirmations.
- **Real-Time Search:** Search bar filters conversation titles and message snippets instantly.
- **Export & Import:** Export individual conversations as TXT or JSON, or download full chat archives. Import previously exported JSON conversations with schema validation.
- **Automatic Pruning:** Automatically prunes empty (0-message) chats on session load.

### 6. Customization & Polish
- **Theme Switcher:** Dark Mode (Obsidian/Slate), Light Mode, and System Default (adapts to OS preferences).
- **Keyboard Shortcuts:**
  - `Enter` -> Send message
  - `Shift + Enter` -> Add new line
  - `Alt + I` -> Toggle Image Generation Mode
  - `Ctrl + K` or `Cmd + K` -> Start New Chat
  - `Ctrl + B` or `Cmd + B` -> Toggle Sidebar
  - `Ctrl + /` or `Cmd + /` -> Open Shortcuts Cheat Sheet
  - `Escape` -> Close modals / Stop generation
- **Custom Modals & Toasts:** No blocking native `alert()` or `confirm()`. All interactions utilize animated modals and non-intrusive toasts.

---

## 🏗️ Architecture & Project Structure

```text
nexo-ai/
│
├── public/                     # Frontend static assets
│   ├── index.html              # Semantic HTML5 layout
│   ├── assets/
│   │   └── logo.svg            # Custom NexoAI gradient logo
│   │
│   ├── css/
│   │   ├── themes.css          # Design tokens & color themes (Dark/Light/System)
│   │   ├── style.css           # Core styling, message bubbles, code cards, inputs
│   │   └── responsive.css      # Tablet & mobile drawer styles
│   │
│   └── js/
│       ├── app.js              # Application bootstrap & event orchestration
│       ├── chat.js             # Chat controller, SSE stream reader, typewriter buffer
│       ├── history.js          # ChatHistoryManager with LocalStorage persistence
│       ├── markdown.js         # XSS-safe Markdown & code card renderer
│       ├── settings.js         # Theme & preference manager
│       └── ui.js               # UI layout controller, modals, toasts, scroll logic
│
├── server/                     # Backend server logic
│   ├── routes/
│   │   ├── chat.js             # SSE streaming route & status check (/api/chat)
│   │   └── image.js            # AI image generation route (/api/image/generate)
│   ├── services/
│   │   ├── gemini.js           # Google Gen AI SDK integration & message normalization
│   │   └── image.js            # FLUX.1 diffusion synthesis service
│   └── middleware/
│       ├── rateLimit.js        # Sliding-window IP rate limiting
│       ├── validateChat.js     # Chat request validation schema
│       └── validateImage.js    # Image request validation schema
│
├── test/                       # Node.js native test suites
│   ├── history.test.js         # Chat history manager unit tests
│   ├── markdown.test.js        # Markdown & XSS sanitizer tests
│   ├── rateLimit.test.js       # Rate limiter middleware tests
│   ├── sse.test.js             # SSE stream parser & error handling tests
│   ├── validateChat.test.js    # Chat request validation tests
│   └── image.test.js           # Image generation validation & service tests
│
├── .env.example                # Environment variable template
├── .gitignore                  # Git ignore rules
├── package.json                # Project dependencies & scripts
├── server.js                   # Express application entry point
└── README.md                   # Complete documentation
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) version 18.0.0 or higher (v20+ recommended)
- [npm](https://www.npmjs.com) version 9.0.0 or higher
- A Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/app/apikey)

---

### Step 1: Clone or Navigate to the Workspace

```bash
cd e:\chatbot
```

---

### Step 2: Install Dependencies

```bash
npm install
```

---

### Step 3: Configure Environment Variables

Create your local `.env` file from the provided `.env.example`:

**On Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**On Linux / macOS:**
```bash
cp .env.example .env
```

Open `.env` in your text editor and set your credentials:

```ini
# Google Gemini API Key from https://aistudio.google.com/app/apikey
GEMINI_API_KEY=AIzaSyYourActualKeyHere

# Model identifier (defaults to gemini-2.5-flash)
GEMINI_MODEL=gemini-2.5-flash

# Port for local server
PORT=3000
```

> **Note:** You can also configure or override your API key directly in the web application under **Settings (⚙️) -> Google Gemini API Key**.

---

### Step 4: Run the Application

Start the server:

```bash
npm start
```

For development with automatic restarts on file changes:

```bash
npm run dev
```

---

### Step 5: Open in Your Browser

Open your browser and navigate to:

```text
http://localhost:3000
```

---

## 🔑 Obtaining a Google Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Sign in with your Google account.
3. Click **"Create API key"**.
4. Copy the generated key.
5. Paste it into your `.env` file as `GEMINI_API_KEY=...` or enter it into the **Settings** dialog in the app.

---

## 🛠️ API Endpoints

### 1. `POST /api/chat`
Streams real-time responses from Gemini using Server-Sent Events.

- **Headers:**
  - `Content-Type: application/json`
  - `x-api-key: <optional_key>` (client-side override)
- **Body:**
  ```json
  {
    "messages": [
      { "role": "user", "content": "Hello NexoAI!" }
    ],
    "model": "gemini-2.5-flash",
    "customSystemPrompt": "Optional custom guidelines",
    "maxTurns": 20
  }
  ```
- **SSE Stream Events:**
  - Chunk: `data: {"text":"chunk_content"}`
  - Completion: `data: {"done":true}`
  - Error: `data: {"error":"Error description","done":true}`

### 2. `GET /api/chat/status`
Returns server connection state without leaking secrets.

- **Response:**
  ```json
  {
    "status": "online",
    "defaultModel": "gemini-2.5-flash",
    "hasApiKey": true
  }
  ```

### 3. `GET /api/health`
Basic health monitoring endpoint.

---

---

---

## 🧪 Automated Testing

NexoAI includes a complete unit and integration test suite powered by Node.js's built-in test runner (`node:test`):

```bash
npm test
```

The test suite contains **42 tests across 5 suites** with 100% pass rate:
- **`test/validateChat.test.js`**: Validates message arrays, turn limits (1-100), character lengths (30,000 per message / 120,000 total), role whitelisting (`user`, `assistant`), and provider-tolerant API key format checks.
- **`test/rateLimit.test.js`**: Verifies sliding-window rate limiting, HTTP headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`), independent IP tracking, and 429 status handling.
- **`test/markdown.test.js`**: Verifies HTML entity escaping against XSS, protocol sanitization (blocking `javascript:` and `data:` schemes), code block syntax cards, and placeholder token collision prevention.
- **`test/history.test.js`**: Verifies chat creation, auto-titling, `removeMessage` on error, `truncateMessagesFrom` on message editing, `pruneEmptyConversations`, schema validation, bounds checks (30,000 chars/message, max 100 messages), and batch JSON imports.
- **`test/streaming.test.js`**: Verifies SSE token accumulation, trailing buffer flushes, server-side `{ error: ... }` event handling, network drop detection (missing `done: true`), and intentional user abortion.

---

## 🛡️ Security & Reliability Architecture

- **Server-First Key Storage:** Primary API keys reside exclusively in the server `.env` file and are never sent to the browser.
- **In-Memory Session Storage:** If a user supplies a custom API key via the web UI, it is stored in `sessionStorage` (in-memory per tab session only) and is never persisted to unencrypted `localStorage` on disk.
- **Upstream Gemini SDK Cancellation:** When a client aborts or disconnects, `res.on('close')` fires `abortController.abort()`, which is directly passed via `config.abortSignal` to the `@google/genai` SDK `generateContentStream` method, preventing orphaned GPU/token consumption on Google's servers.
- **Separate Endpoint Rate Limiting:** The sliding-window rate limiter is attached specifically to `POST /api/chat`, ensuring that frequent polling or status checks on `GET /api/chat/status` do not burn the user's message rate limit.
- **Configurable CORS:** Configured with optional `CORS_ORIGIN` environment variable to restrict cross-origin access in production environments.
- **Server Request Schema Validation:** Incoming chat payloads are validated by `validateChatRequest` middleware before any SDK execution, preventing malformed payloads, role tampering, and abusive token usage.
- **Spoof-Resistant Rate Limiting:** The sliding-window rate limiter relies on Express `req.ip` configured with explicit reverse proxy trust (`TRUST_PROXY`), preventing header spoofing via arbitrary `X-Forwarded-For` headers.
- **Safe DOM Construction:** Dynamic user titles, group labels, and toasts use `textContent` and programmatic DOM element creation instead of unchecked `innerHTML` interpolation.
- **XSS-Safe Markdown Renderer:** Escapes all HTML entities, validates URL schemes (`http`, `https`, `mailto`), and isolates code blocks using conflict-safe delimiters (`%%NEXOCODEBLOCK%%`).
- **Resilient Storage & Quota Management:** Auto-prunes empty abandoned conversations while keeping the active workspace intact, and recovers gracefully from `QuotaExceededError` with user-friendly alerts.
- **Clean Streaming Lifecycle:** SSE streams track `receivedDone` events; trailing chunk buffers are flushed, adaptive typewriter token draining prevents burst lag, and immediate history cleanup on error ensures failed generations never pollute AI context.
- **Full Accessibility:** ARIA live regions (`role="log" aria-live="polite"`), modal dialog semantics (`role="dialog" aria-modal="true"`), and reduced motion support via `@media (prefers-reduced-motion: reduce)`.

---

## 🏢 Production Readiness Roadmap

For enterprise or multi-user cloud deployments:
1. **User Authentication & Multi-Tenancy:** Replace client `localStorage` with a persistent database (PostgreSQL / MongoDB) with JWT or OAuth2 session authentication to isolate user conversations.
2. **Distributed Rate Limiting:** Replace the in-memory sliding-window limiter with a Redis-backed rate limiter (`ioredis`) for multi-replica Kubernetes or serverless deployments.
3. **Encrypted Key Vault:** Store user-provided API keys in an encrypted secrets vault (e.g. AWS Secrets Manager, Google Secret Manager, or HashiCorp Vault).

---

## 🔧 Troubleshooting Guide

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **"Google Gemini API key is missing or invalid"** | `GEMINI_API_KEY` is not set or has default placeholder text. | Add your key to `.env` or open **Settings (⚙️)** in the app and paste your key. |
| **"Gemini API quota exhausted or rate limit reached (429)"** | Your free tier rate limit was exceeded. | Wait 30–60 seconds, or switch to `gemini-2.0-flash` or `gemini-1.5-flash` in Settings. |
| **"The requested model was not found (404)"** | The model name in `GEMINI_MODEL` is deprecated or unavailable. | Use `gemini-2.5-flash` (recommended default) or `gemini-2.0-flash`. |
| **"Could not reach Google Gemini API servers (503)"** | Internet connection issue or firewall blocking outbound requests. | Verify your network connection and DNS access to Google endpoints. |
| **Port 3000 is already in use** | Another application is bound to port 3000. | Change `PORT=3001` in your `.env` file and restart. |
| **Response stopped unexpectedly** | User clicked Stop button or pressed Escape. | Click the **Retry** or **Regenerate** button to resume. |

---

## 📜 License

This project is licensed under the MIT License.
