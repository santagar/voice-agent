# Voice Agent

Voice Agent is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# 🧠 How the Assistant Pipeline Works (Realtime + TTS)

This project combines **OpenAI Realtime** (for reasoning and text
generation) with **OpenAI TTS** (for voice output).\
The two systems work together, but they serve very different purposes.

## 1. Realtime = *The Brain*

The Realtime model (e.g., `gpt-4o-realtime-preview`) is responsible for:

-   understanding the user message\
-   following instructions\
-   applying system rules\
-   using the knowledge base (RAG/vector search)\
-   generating clean, helpful responses\
-   deciding tone, personality, style

Configuration happens in `realtime-server.js` (loading identity + rules from `config/assistant-profile.json`):

``` js
const sessionUpdate = {
  type: "session.update",
  session: {
    modalities: ["text"],
    instructions: sessionInstructions,
  },
};
```

### What Realtime *does*

-   Obeys system instructions\
-   Adopts tone/personality\
-   Responds in multiple languages\
-   Uses your knowledge base\
-   Produces speech-friendly natural text

### What Realtime *does not* do

-   It does **not** produce audio\
-   It does **not** apply voice parameters

## 2. TTS = *The Voice*

After Realtime generates text, the frontend sends it to the TTS
endpoint:

``` ts
await client.audio.speech.create({
  model: "gpt-4o-mini-tts",
  voice: voice || "alloy",
  input: text,
});
```

TTS:

-   does **not** accept instructions\
-   does **not** maintain context\
-   simply converts text → audio

## 3. Why You Cannot Add `instructions` to TTS

TTS only accepts:

-   `model`
-   `voice`
-   `input`
-   `format`

Behavioral instructions belong to **Realtime**, not TTS.

## 4. End-to-End Flow

    User → WebSocket → realtime-server.js
          → OpenAI Realtime (text generation)
          ← assistant text

    Frontend → /api/tts → OpenAI TTS
          ← audio output

Summary:

  Step   Component      Responsibility
  ------ -------------- -----------------------------
  1      **Realtime**   Think, decide, follow rules
  2      **TTS**        Speak the text

## 5. How to Achieve Natural Speech

-   Put tone/style rules in Realtime instructions\
-   Generate conversational, short, clear sentences\
-   Use punctuation for natural pauses

## 6. Summary

-   **Realtime** controls intelligence, tone, rules, and knowledge.\
-   **TTS** only converts text to speech.\
-   Natural output depends on writing good, spoken-friendly text.\
-   The system is intentionally split: one engine thinks, the other
    speaks.

## Explore Official Audio Demos

If you want to preview the latest Realtime + TTS experience without running the project locally, head over to [OpenAI FM](https://www.openai.fm/) and try the live web demo. For more implementation details, follow the official Audio guide in the OpenAI docs: https://platform.openai.com/docs/guides/audio.

## Customizing the Assistant

To shape the agent’s identity, safety posture, and sanitization rules without touching the code, edit the JSON files under `config/`:

- `config/assistant-profile.json` – add new strings to the `identity` array for style/personality and append business policies to `safety_rules`. These lines are concatenated and sent as the Realtime `session.instructions`.
- `config/sanitization-rules.json` – each entry represents a regex rule (`pattern` + `flags`) and a `replacement`. Add more objects if you need to scrub extra secrets or domain-specific data before responses reach the UI.
- `config/sanitization-rules.json` – each entry represents a regex rule (`pattern` + `flags`) and a `replacement`. Add more objects if you need to scrub extra secrets or domain-specific data before responses reach the UI.

The server reads `assistant-profile.json` dynamically: any key whose value is an array (`identity`, `safety_rules`, future blocks such as `tone_guidelines`, `tool_instructions`, etc.) is appended in order to the final instructions. The key names themselves are only labels to keep the profile organised, so you can add new sections without touching the backend. Extend it freely with extra arrays (escalation policies, compliance notes, custom prompts) and simply restart `npm run realtime` to pick up the changes.

Any time you grow those files, restart `npm run realtime` so the server reloads the updated configuration.

### Knowledge Base Workflow

1. Drop source material inside the `knowledge/raw` folder. Markdown or plain text files must start with a JSON block enclosed between `---` delimiters specifying `id`, `scope`, `tags`, `languages`, and anything else you want to track. Example:

    ```md
    ---
    {
      "id": "support-channels",
      "scope": "support",
      "tags": ["soporte", "contacto"],
      "languages": ["es", "en"]
    }
    ---
    Texto libre…
    ```
    
    - `id`: Unique identifier for the snippet; use kebab-case to keep paths readable.
    - `scope`: Logical bucket you want to filter on (e.g., `general`, `support`, `tech`); the realtime server can request the scope that best matches the conversation.
    - `tags`: Array of keywords that describe the entry. They are stored for future tooling/search even if the model does not use them yet.
    - `languages`: Languages covered by the snippet (e.g., `["es", "en"]`). You can list more than one if the same text serves multiple locales.

2. Run `npm run build:kb`. The script consolidates `knowledge/raw` into `knowledge/knowledge-items.json` and regenerates embeddings in `knowledge/knowledge-vectors.json`, which the realtime server consumes for RAG.

This keeps the runtime format standardized while giving you freedom to add new documents or data sources inside `knowledge/raw`.

### Tools / Function Calling

- Define structured tools in `config/tools.json`. Each entry needs `name`, `description`, and a JSON Schema `parameters` object just like OpenAI’s `tools` payload.
- The realtime server automatically loads those definitions, forwards them via `session.update`, and listens for `response.required_action`. When the model calls a tool, `realtime-server.js` invokes the corresponding handler and posts the result back with `tool_outputs.create`.
- Out of the box there are two demo tools (`lookup_booking`, `check_availability`) that hit dedicated Next.js API routes (`/api/tools/bookings/:locator`, `/api/tools/products/check-availability`). You can inspect those handlers to understand how to implement business logic in this repo.
- For external services set `TOOL_API_BASE_URL` (and optionally `CORE_API_TOKEN`) in `.env`. Any tool definition that includes a `routes` object (`method`, `path`) will then be proxied via `fetch`, automatically injecting path params like `:locator` and serializing the request body.
- To expand: add more entries to `config/tools.json`, create corresponding `app/api/...` handlers (or point to another backend), and extend `handleToolCall` if you need custom auth or response formatting. The UI already surfaces tool invites (see `/lab`) and you can log extra metadata when a tool is invoked.
- Reserve the `/api/tools/*` namespace for endpoints that serve tool calls so UI-only routes (`/api/tts`, `/api/scopes`, etc.) stay separate from the assistant’s callable surface. The `/api/scopes` endpoint now exposes both the catalog (GET) and vector-based scope detection (POST) used by the Lab.

### Vector Database (Optional)

If you want low-latency ANN search, point the project to a Pinecone index:

1. Create an HNSW index in Pinecone (dimension must match the embedding model, e.g., 1536 for `text-embedding-3-small`).
2. Set the following environment variables before running `npm run build:kb` or `npm run realtime`:

   - `PINECONE_API_KEY`
   - `PINECONE_INDEX_HOST` (full HTTPS host, e.g., `https://my-index-xxxx.svc.us-east1-aws.pinecone.io`)
   - `PINECONE_NAMESPACE` (optional, defaults to `default`)
   - `PINECONE_BATCH_SIZE` / `PINECONE_TOP_K` (optional tunables)

3. Run `npm run build:kb`. Besides writing the JSON artifacts, the script upserts every vector to Pinecone (metadata includes scope/tags/languages).
4. Start `npm run realtime`. When Pinecone env vars are present, the server queries Pinecone first and falls back to the local cosine similarity if the request fails.

This lets you benefit from Pinecone’s ANN search while keeping the local JSON files as a portable fallback.

**Pinecone setup quick tips**

- Choose the *Dense* vector type (Sparse targets keyword-style embeddings).
- Keep dimension = 1536 (or the dimension of whatever embedding model you configure).
- Use cosine metric to match how the fallback implementation measures similarity.

**Limitations & Tips**

- The ingest script only processes Markdown (`.md`) and plain text (`.txt`) files. Unsupported formats (PDF, images, audio) must be converted to text before they can enrich the KB.
- For structured sources like large `openapi.json` specs, consider summarizing key sections into prose or splitting them into multiple text fragments. Feeding extremely long JSON blobs directly is inefficient and harder for embeddings to digest.
- If you need native support for other formats, extend `scripts/build-knowledge.cjs` with additional parsers (for example, PDF-to-text or custom JSON chunking) so that the final output still becomes clean text plus metadata.

## Deployment & Operations Guide

### Prerequisites

- Node.js 18+ and npm (or pnpm/bun) installed locally.
- An OpenAI API key with access to Realtime + TTS.
- Optional (recommended for production): a Pinecone index configured for dense vectors (dimension 1536, cosine metric).

### Environment variables

1. Start with the template: `cp .env.example .env`.
2. Mandatory values:
   - `OPENAI_API_KEY`
   - `REALTIME_PORT` (default `4001`, used by `realtime-server.js`)
3. Optional but recommended:
   - `PINECONE_API_KEY`, `PINECONE_INDEX_HOST`, `PINECONE_NAMESPACE`, `PINECONE_TOP_K`, `PINECONE_BATCH_SIZE`
   - `TOOL_API_BASE_URL` / `CORE_API_BASE_URL` and `CORE_API_TOKEN` if your function-calling bridge must reach another backend.

Restart both dev processes whenever you update `.env` so the changes propagate.

### Building knowledge vectors

```bash
# ingest /knowledge/raw → JSON artifacts and Pinecone (if configured)
npm run build:kb
```

This command:

1. Validates every entry in `knowledge/raw`.
2. Generates embeddings with `text-embedding-3-small`.
3. Writes `knowledge/knowledge-items.json` + `knowledge/knowledge-vectors.json`.
4. Upserts vectors to Pinecone when its env vars are present.

Run it any time you add or modify KB documents.

### Local runtime

Use two terminals:

```bash
# Terminal A – Realtime bridge (WS + tools + KB)
npm run realtime

# Terminal B – Next.js app (/assistant, /lab, API routes)
npm run dev
```

Or use the convenience script `npm run dev:all` (spawns both via `concurrently`). Visit `/assistant` for the baseline UI or `/lab` for the advanced call lab. Keep the realtime server running whenever the UI needs to stream through OpenAI.

### Production deployment notes

- Deploy the Next.js app wherever you normally host (Vercel, Render, custom Node server). Ensure `/api/tts` and any `/api/...` tool routes are reachable over HTTPS.
- Deploy `realtime-server.js` as a standalone Node process (e.g., PM2, Fly.io, ECS). Expose the WS port securely and, if needed, sit it behind an auth or session layer.
- Store `.env` secrets using your platform’s secret manager. Never bake API keys into frontend bundles.
- Before each deploy:
  1. Commit KB changes and rerun `npm run build:kb`.
  2. Verify Pinecone synchronization (check logs for “Syncing … vectors”).
  3. Smoke-test `npm run dev:all` locally to confirm tools, speech, and KB lookups behave as expected.
- Monitor both processes: logs from `/lab` should show tool usage, while `realtime-server.js` logs every OpenAI event to help debug failures.

Following the checklist above keeps deployment repeatable and documents the requirements (OpenAI credentials, Pinecone index, tool endpoints) for anyone onboarding to the project.

## Roadmap & Voice-Agent Parity

- **Full speech-to-speech mode:** The current lab view still relies on browser-side SpeechRecognition + `/api/tts`. To match the “Voice Agent” architecture, we need to migrate to OpenAI’s Realtime audio tracks (WebRTC) so audio flows directly through the session.
- **Server-side STT:** Replace the Web Speech API with `input_audio_buffer.append` (or WebRTC upstream) to capture audio on the server and keep policies enforced centrally.
- **Session identity & auth:** Introduce per-session IDs, auth tokens, and logging so multiple clients can connect safely to the realtime bridge.
- **Vector DB hardening:** Switch from local JSON fallback to persisted vector DB only, add filters & metadata facets, and monitor drift between KB versions and Pinecone.

> Tooling/function calling support already ships today: just add entries to `config/tools.json` and wire the corresponding handler (or API proxy) so `realtime-server.js` can fulfil tool invocations.
