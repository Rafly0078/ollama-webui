# Ollama Chat — AI WebUI

A production-ready, ChatGPT-style web interface for your **local Ollama models**, built to deploy on **Vercel as a frontend only**. It talks to an **external API endpoint** (which you run and which forwards requests to your local Ollama server) — the URL is provided entirely through an environment variable. **No backend runs on Vercel** and **localhost is never hardcoded.**

![Next.js 15](https://img.shields.io/badge/Next.js-15-black) ![React 19](https://img.shields.io/badge/React-19-149eca) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6) ![Tailwind](https://img.shields.io/badge/Tailwind-3-38bdf8)

---

## ✨ Features

**Chat experience**
- Real token **streaming** via `fetch` + `ReadableStream` with **AbortController** (stop / regenerate / continue)
- **Markdown**, **syntax-highlighted code** with copy button, **LaTeX** (KaTeX), **tables**, and **Mermaid diagrams**
- **Image support** for vision models (upload / paste / drag & drop)
- Edit, delete, retry messages · auto-scroll with scroll-to-bottom button · typing indicator
- Live **token counter**, **response time**, and **generation speed (tok/s)**

**Conversations** — create, rename (double-click), delete, **search** (title + content), **pin**, **duplicate**, export as **`.md`** and **`.json`**.

**Prompt & model controls** — system-prompt editor with presets · temperature, top_p, top_k, repeat penalty, context length, max tokens · model switcher showing **size, context length, quantization, and family**, auto-loaded from `GET /api/models`.

**Input area** — auto-growing textarea · drag & drop files · paste image · upload image / PDF / TXT · prompt suggestions · **slash commands** (`/system`, `/params`, `/clear`, `/summarize`, …).

**Design** — dark mode default, glassmorphism, rounded cards, gradients, animated background, fully responsive & mobile-first, collapsible sidebar, Framer Motion micro-interactions, loading skeletons.

**Settings** — theme, accent color, API URL override, default model, default system prompt, default generation params, prompt presets, plus **export / import** of both settings and conversations.

**Robustness** — beautiful error screens, retry buttons, offline detection, connection timeout, auto-reconnect with backoff, and meaningful API error messages.

**Accessibility & shortcuts** — `Ctrl/⌘+K` command palette · `Ctrl/⌘+B` toggle sidebar · `Ctrl/⌘+Shift+O` new chat · `Ctrl/⌘+Enter` send · `Esc` stop generation · ARIA labels · full keyboard/tab navigation.

**Everything is stored locally** (chats, settings, pinned chats, recent models, theme, presets) in `localStorage`.

---

## 🏗️ Architecture

```
Browser (this app, hosted on Vercel)
        │  fetch() + streaming, AbortController
        ▼
NEXT_PUBLIC_API_URL   ── your external API (you host this) ──►  Ollama (localhost:11434)
```

The frontend calls these endpoints on `NEXT_PUBLIC_API_URL`:

| Method | Path                | Purpose                              |
| ------ | ------------------- | ------------------------------------ |
| GET    | `/api/models`       | List installed models                |
| POST   | `/api/chat`         | Non-streaming completion             |
| POST   | `/api/chat/stream`  | **Streaming** completion (NDJSON/SSE)|
| POST   | `/api/generate`     | Raw generate (compatible)            |
| POST   | `/api/embeddings`   | Embeddings (compatible)              |

The streaming parser accepts **both** Ollama-native NDJSON (one JSON object per line) and **SSE** (`data: {…}` / `data: [DONE]`), so most proxies work without changes.

### Feature-based folder structure

```
src/
├── app/                     # Next.js App Router (layout, page, settings, providers, theming)
├── components/
│   ├── ui/                  # Button, Modal, Slider, Switch, Tooltip, Toast, Skeleton
│   ├── markdown/            # Markdown, CodeBlock (copy), Mermaid (lazy)
│   ├── AnimatedBackground · ConnectionStatus · OfflineBanner · ErrorScreen · ApiConfigNotice
├── features/
│   ├── chat/                # ChatView, MessageList, MessageBubble, ChatInput, TopBar, panels + useChat
│   ├── sidebar/             # Sidebar, ChatListItem
│   ├── models/              # ModelSelector, useModels
│   └── command/             # CommandPalette (Ctrl+K)
├── lib/
│   ├── api/                 # config, types, client, stream  (the only place env is read)
│   ├── store/               # Zustand stores (chat, settings) + defaults
│   ├── hooks/               # auto-scroll, online, media-query, hydrated, shortcuts
│   └── utils/               # cn, id, format, export, files
└── types/                   # shared domain types
```

State is managed with **Zustand + persist** (localStorage) — chosen over raw Context to minimize re-renders during high-frequency streaming updates (a core performance requirement). Selectors keep components subscribed only to the slices they use.

---

## 🚀 Getting started

### 1. Install

```bash
npm install
```

### 2. Configure the API endpoint

Copy the example env file and point it at your reachable API (not localhost):

```bash
cp .env.example .env.local
# edit .env.local
NEXT_PUBLIC_API_URL=https://my-ollama-api.example.com
```

> You can also override the URL at runtime from **Settings → Connection** (stored per-browser).

### 3. Run

```bash
npm run dev        # http://localhost:3000
npm run build      # production build
npm run start      # serve the production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

---

## ☁️ Deploy to Vercel

1. Push this repo to GitHub/GitLab and **Import** it in Vercel.
2. Add an environment variable **`NEXT_PUBLIC_API_URL`** = your external API URL.
3. Deploy. That's it — the frontend is fully static/client-rendered; no server functions are used.

Because the browser calls your external API directly, that API **must send permissive CORS headers** for your Vercel origin, e.g.:

```
Access-Control-Allow-Origin: https://your-app.vercel.app
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

---

## 🔌 Exposing local Ollama as an external API

Ollama already serves a compatible HTTP API on `http://localhost:11434`. To make it reachable from the deployed frontend you need a public, HTTPS endpoint. Common options:

- **Tunnel** (quickest): `cloudflared tunnel --url http://localhost:11434` or `ngrok http 11434`, then set `NEXT_PUBLIC_API_URL` to the tunnel URL. Add a tiny reverse proxy if you need to add CORS headers or map `/api/chat/stream` → Ollama's `/api/chat` (which streams by default).
- **Reverse proxy** (Nginx/Caddy) in front of Ollama that adds CORS and TLS.

A minimal mapping most proxies need:

| This app calls      | Forward to Ollama            |
| ------------------- | ---------------------------- |
| `/api/models`       | `/api/tags`                  |
| `/api/chat/stream`  | `/api/chat` (`"stream":true`)|
| `/api/chat`         | `/api/chat` (`"stream":false`)|

The client sends Ollama-style bodies (`model`, `messages[]`, `options.{temperature,top_p,top_k,repeat_penalty,num_ctx,num_predict}`, `images[]`), so a pass-through proxy generally needs no body translation.

---

## 🎨 Design system

Built to a strict premium/mobile-first spec — elegant, minimal, and battery-efficient.

**Palette (dark, default)** — background `#09090B` · surface `#111113` · card `#18181B` · border `rgba(255,255,255,.06)` · primary `#7C3AED` · secondary `#A855F7` · success `#22C55E` · warning `#F59E0B` · error `#EF4444`. All exposed as CSS variables; accent is runtime-themeable.

**Typography** — Inter with a restrained hierarchy, generous spacing, and readable line-height. Reading column capped at **860px**.

**Motion** — only `opacity` / `transform` / `scale` / `translate` are ever animated, 120–250ms, GPU-accelerated. **Never** `width`, `height`, `top`/`left`, `box-shadow`, `filter`, or `border-radius`. Springs are used sparingly (dialogs, toasts). `prefers-reduced-motion` is respected globally (CSS + Framer `MotionConfig reducedMotion="user"`).

**Glass, used sparingly** — persistent chrome (sidebar, top bar) uses a single `blur(8px)` layer. Floating popovers (menus, command palette, dialogs) are **solid** `.popover` surfaces, so blur layers are never stacked. Cards use soft borders and very subtle static shadows.

**Background** — no canvas/WebGL/particles/Lottie. Just two static radial gradients, a faint inline-SVG noise texture, and one optional soft glow (single non-animated `filter`). Costs zero CPU after paint.

**Cards** — 18–24px radii, `rgba(255,255,255,.06)` borders, `shadow-card`/`shadow-subtle`.

**Touch & a11y** — 44px touch targets on the input dock, focus-visible rings, ARIA roles/labels, `aria-live` message log, high-contrast text.

## ⚡ Performance notes

- **Markdown pipeline is fully code-split.** `react-markdown` + remark/rehype + **KaTeX** + **highlight.js** (and their CSS) load behind a `React.lazy` + `Suspense` boundary — the homepage First Load JS is **~150 kB** (from 323 kB before splitting). The Suspense fallback renders raw text with matching typography, so there's no layout shift when the renderer swaps in.
- **KaTeX/highlight.js CSS** ships in its own async chunk (~26 kB), not in the initial stylesheet.
- **Mermaid** and **pdf.js** are dynamically imported — they never touch the initial bundle.
- **LazyMotion** loads only the Framer Motion features used; `optimizePackageImports` tree-shakes `lucide-react` and `framer-motion`.
- **Native virtualization** via CSS `content-visibility: auto` + `contain-intrinsic-size` — offscreen, settled messages skip layout/paint with **zero extra libraries**, and the live streaming message stays fully rendered so highlight/copy/mermaid state is never lost.
- Memoized message rendering (`React.memo`), selector-scoped Zustand subscriptions, and streaming updates that mutate only the active message — no list-wide re-renders.
- Static background (no rAF loop), 60 FPS transform/opacity animations, and full `prefers-reduced-motion` support.

**Targets:** built for Lighthouse mobile Performance > 95, FCP < 1.5s, and smooth 60 FPS on low-end Android. The static prerender + tiny initial JS + system-font-swap keep FCP low; run `npx next build && npx next start` then Lighthouse against `http://localhost:3000` to verify on your hardware.

## ♿ Accessibility

ARIA roles/labels on interactive controls, focus-visible rings, keyboard-navigable menus/palette, `aria-live` message log, and reduced-motion compliance.

---

## 📝 License

MIT — do whatever you like. Built as a local-first, privacy-respecting UI: your prompts and data never leave your own Ollama server.
