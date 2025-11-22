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

# 🧠 How the Assistant Pipeline Works (Realtime Audio)

This project is evolving toward a **full speech-to-speech** pipeline built on **OpenAI Realtime**. The Realtime model handles both reasoning and speech, while the vector KB provides context (RAG).

High-level voice flow:

```text
User (microphone)
   ↓ (WebRTC/WS audio)
Next.js frontend (AudioClient)
   ↓
Realtime Bridge (realtime-server.js)
   ↓ (OpenAI Realtime: gpt-4o-mini-realtime-preview)
RAG (Pinecone / JSON)
   ↓
Realtime Bridge
   ↓ (audio PCM16 + text)
Next.js frontend → AudioContext → speakers
```

## 1. Realtime = *The Brain + Ears + Mouth*

The Realtime model (e.g., `gpt-4o-mini-realtime-preview`) is responsible for:

- Understanding user speech and text.
- Following instructions and safety rules.
- Using the knowledge base (RAG/vector search).
- Generating helpful, speech-ready responses.
- Producing audio (PCM16) and text in a single session.

Configuration happens in `realtime-server.js` (loading the assistant profile from `config/profile.json`), and the Realtime model is selected via environment variables:

- `REALTIME_MODEL` – primary Realtime model used by the WS bridge (default: `gpt-4o-mini-realtime-preview`).
- `REALTIME_MODEL_PREMIUM` – optional higher-capacity “premium” variant (default: `gpt-4o-realtime-preview`) that you can route to later if you add tiering logic.

The bridge opens an OpenAI Realtime session with both text and audio enabled:

```js
const sessionUpdate = {
  type: "session.update",
  session: {
    modalities: ["text", "audio"],
    instructions: sessionInstructions,
    input_audio_format: "pcm16",
    output_audio_format: "pcm16",
    tools: openAITools.length ? openAITools : undefined,
  },
};
```

On the client side, the lab view (`/lab`) uses an `AudioClient`-style pattern:

- Captures microphone audio via `getUserMedia`.
- Encodes it as PCM16 and streams it over WebSocket to `realtime-server.js`.
- Receives PCM16 audio chunks back from the Realtime bridge and plays them via `AudioContext`.

The same Realtime session also streams text deltas (`response.text.delta` / `response.text.done`) for on-screen chat bubbles.

## 2. RAG = *Context Memory*

The Realtime bridge enriches each user text message with RAG context before it reaches the model:

- Embeddings are generated via `EMBEDDING_MODEL` (default: `text-embedding-3-small`).
// Vector search runs either against Pinecone (when configured) or the local JSON backing store in `knowledge/vectors.json`.
- The selected snippets are prepended to each user turn as an internal context block (not read verbatim to the user).

For audio-only turns, the Realtime model itself transcribes the speech internally as part of the same session, and the usual RAG logic applies once text is available.

## 3. TTS HTTP = *Legacy / Fallback Path*

There is still a legacy HTTP TTS endpoint used by older views (`/chat` and parts of `/lab`):

```ts
await client.audio.speech.create({
  model: process.env.TTS_MODEL ?? "gpt-4o-mini-tts",
  voice: voice || "alloy",
  input: text,
});
```

Key points:

- Controlled via `TTS_MODEL` (default: `gpt-4o-mini-tts`; you can bump to `gpt-4o-tts`).
- The TTS path does not accept instructions or maintain context; it only turns text into audio.
- In the long term, the **normal** voice path should use Realtime Audio (the diagram above), and HTTP TTS should be considered a fallback or compatibility layer.

## 4. Why You Cannot Add `instructions` to TTS

TTS only accepts:

- `model`
- `voice`
- `input`
- `format`

Behavioral instructions belong to **Realtime**, not TTS. Put style, safety, and tone rules into the Realtime session instructions (see `config/assistant-profile.json`).

## 5. End-to-End Flow (Realtime Audio)

```text
User (mic) → WebRTC/WS audio
  → Next.js frontend (`/lab` AudioClient)
  → websocket: ws://localhost:${REALTIME_PORT}
  → realtime-server.js
  → OpenAI Realtime (`REALTIME_MODEL` with text+audio)
  → RAG (Pinecone / JSON vectors)
  → Realtime bridge (text + PCM16 audio)
  → frontend AudioContext → speakers
```

Summary:

  Step   Component           Responsibility
  ------ ------------------- ----------------------------------------
  1      **AudioClient**     Capture mic audio, play PCM16 output
  2      **Realtime bridge** RAG, tools, sanitization, session rules
  3      **Realtime model**  Think, transcribe, and speak

## 6. How to Achieve Natural Speech

- Put tone/style rules in Realtime instructions.
- Generate conversational, short, clear sentences.
- Use punctuation for natural pauses and clarity.

## 7. Summary

- **Realtime** controls intelligence, tone, rules, knowledge, and audio.
- **RAG** feeds company/context knowledge into each relevant turn.
- **TTS HTTP** is a temporary/legacy path; prefer Realtime Audio for production-quality voice agents.

## Explore Official Audio Demos

If you want to preview the latest Realtime + TTS experience without running the project locally, head over to [OpenAI FM](https://www.openai.fm/) and try the live web demo. For more implementation details, follow the official Audio guide in the OpenAI docs: https://platform.openai.com/docs/guides/audio.

## Customizing the Assistant

To shape the agent’s identity, safety posture, and sanitization rules without touching the code, edit the JSON files under `config/`:

- `config/profile.json` – defines the assistant profile in logical blocks (identity, tone, answers, tools, escalation, safety). All arrays are concatenated and sent as the Realtime `session.instructions`.
- `config/sanitize.json` – each entry represents a regex rule (`pattern` + `flags`) and a `replacement`. Add more objects if you need to scrub extra secrets or domain-specific data before responses reach the UI.

The server reads `profile.json` dynamically: any key whose value is an array (`identity`, `tone_guidelines`, `answer_policies`, `tool_policies`, `escalation_policies`, `safety_rules`, etc.) is appended in order to the final instructions. The key names themselves are only labels to keep the profile organised, so you can add new sections without touching the backend. Extend it freely with extra arrays (compliance notes, custom prompts) and simply restart `npm run realtime` to pick up the changes.

### Assistant profile structure (`config/profile.json`)

The profile file is organised into logical blocks so you can reason about the agent’s behaviour without digging into code:

- `identity` – who the agent is and what it is for (role, domain, responsibilities).
- `tone_guidelines` – personality and communication style (tone, pacing, languages, “voice affect”, brand flavour).
- `answer_policies` – how to structure responses (brevity, clarity, how to confirm actions, when to use lists vs. paragraphs).
- `tool_policies` – explicit rules about when and how to call tools (both business tools like `lookup_booking` and session tools like `end_call`, `mute_speaker`, `set_voice`).
- `escalation_policies` – when to escalate or say “no” (limits of what the agent should handle vs. what should be passed to humans or other systems).
- `safety_rules` – hard limits for security and compliance (no secrets, no fake bookings, infrastructure red lines, etc.).

All of these are plain arrays of strings. The bridge concatenates them (with section headings derived from the keys) into the `session.instructions` string used by Realtime. In practice:

- If you want to change the agent’s “role” or scope → edit `identity`.
- If you want it more formal/casual, or to restrict languages → edit `tone_guidelines`.
- If you want shorter answers or more explicit confirmations → edit `answer_policies`.
- If you introduce new tools (`config/tools.json`) → document how and when to use them in `tool_policies`.
- If you need specific escalation logic (when to hand off to humans) → add entries to `escalation_policies`.
- For non-negotiable security/compliance rules → use `safety_rules`.

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

2. Run `npm run build:kb`. The script consolidates `knowledge/raw` into `knowledge/items.json` and regenerates embeddings in `knowledge/vectors.json`, which the realtime server consumes for RAG.

This keeps the runtime format standardized while giving you freedom to add new documents or data sources inside `knowledge/raw`.

### Tools / Function Calling

- Define structured tools in `config/tools.json`. Each entry needs `name`, `description`, and a JSON Schema `parameters` object just like OpenAI’s `tools` payload.
- The realtime server automatically loads those definitions, forwards them via `session.update`, and listens for `response.required_action`. When the model calls a tool, `realtime-server.js` invokes the corresponding handler and posts the result back with `tool_outputs.create`.
- Out of the box there are two demo tools (`lookup_booking`, `check_availability`) that hit dedicated Next.js API routes (`/api/tools/bookings/:locator`, `/api/tools/products/check-availability`). You can inspect those handlers to understand how to implement business logic in this repo.
- For external services set `TOOL_API_BASE_URL` (and optionally `CORE_API_TOKEN`) in `.env`. Any tool definition that includes a `routes` object (`method`, `path`) will then be proxied via `fetch`, automatically injecting path params like `:locator` and serializing the request body.
- To expand: add more entries to `config/tools.json`, create corresponding `app/api/...` handlers (or point to another backend), and extend `handleToolCall` if you need custom auth or response formatting. The UI already surfaces tool invites (see `/lab`) and you can log extra metadata when a tool is invoked.
- Reserve the `/api/tools/*` namespace for endpoints that serve tool calls so UI-only routes (`/api/scopes`, `/api/transcribe`, etc.) stay separate from the assistant’s callable surface. The `/api/scopes` endpoint now exposes both the catalog (GET) and vector-based scope detection (POST) used by the Lab.

#### Tool specification and types

Each tool entry in `config/tools.json` follows this structure:

- `name` (string, required): the tool name exposed to the model.
- `description` (string, required): short natural language description of what the tool does and when to use it.
- `parameters` (object, required): JSON Schema describing the tool arguments, in the same shape as OpenAI’s `tools.parameters`.
- `kind` (string, optional but recommended):
  - `"business"` – tools that implement domain/business logic (e.g., bookings, availability, tickets). These usually call backend APIs.
  - `"session"` – tools that control session/UI behavior (e.g., ending the call, muting, changing the voice).
- `routes` (object, optional, business tools only):
  - `method` – HTTP method (`GET`, `POST`, etc.).
  - `path` – path template under `/api/tools/*` or another backend (supports `:param` segments).
- `ui_command` (string, optional, session tools only):
  - Name of the UI command forwarded to the frontend (`"end_call"`, `"mute_speaker"`, `"set_voice"`, etc.).
- `session_update` (object, optional, session tools only):
  - Declarative mapping for session updates applied on the Realtime connection.
  - Example: `{ "voiceParam": "voice" }` means “read the `voice` argument and send `session.update { voice }`”.

The server does not hardcode tool names; it only looks at `kind`, `routes`, `ui_command`, and `session_update` to decide how to route calls.

#### Adding business tools

Business tools encapsulate backend behavior such as booking lookup, availability checks, or ticket creation:

1. Add a new entry to `config/tools.json` with:
   - `kind: "business"`.
   - A clear `name`, `description`, and `parameters`.
   - A `routes` object that points to the HTTP handler.
2. Implement the handler under `app/api/tools/...` or behind a backend URL configured via `TOOL_API_BASE_URL` / `CORE_API_BASE_URL`:
   - For Next.js API routes, keep them under `/api/tools/*` so they are clearly separated from UI-only routes.
   - The realtime bridge will call your handler via `fetch`, automatically:
     - Injecting `:params` from the tool args into the path.
     - Serializing the body for non-GET methods.
3. The model can now call the tool by name; the bridge forwards the result back via `tool_outputs.create`, and the UI can display a summary or structured data in `/lab`.

#### Adding session/UI tools

Session tools control the “shell” of the agent: ending calls, muting, or changing voice. They are still tools from the model’s perspective but are implemented locally:

1. Add a new entry to `config/tools.json` with:
   - `kind: "session"`.
   - `ui_command` set to the command you want to send to the frontend (for example: `"end_call"`, `"mute_speaker"`, `"set_voice"`).
   - Optional `session_update` block if the tool should change Realtime session state (`voice`, etc.).
   - A `parameters` schema that describes any arguments (for example, `voice` for `set_voice`).
2. The bridge (`realtime-server.js`) forwards session tools as:
   - A `ui.command` event to the client:

     ```json
     {
       "type": "ui.command",
       "command": "end_call",
       "args": { ... }
     }
     ```

   - An optional `session.update` to the Realtime API when `session_update` is present (for example, updating `session.voice` for `set_voice`).
3. The frontend hook (`useRealtimeVoiceSession`) listens for `ui.command` and maps them to local behavior:
   - `end_call` → calls `endCall()` and cleans up audio.
   - `mute_speaker` / `unmute_speaker` → toggles the output audio state.
   - `mute_mic` / `unmute_mic` → toggles the mic state (affects audio in + STT).
   - `set_voice` → currently applied via `session.update` on the server; you can optionally show a system message in the UI.

This separation keeps the agent’s behavior declarative in `config/tools.json` while making it clear where to plug in business logic (`/api/tools/*`) and where to plug UI/session behavior (`useRealtimeVoiceSession`).

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
- An OpenAI API key with access to Realtime (audio + text).
- Optional (recommended for production): a Pinecone index configured for dense vectors (dimension 1536, cosine metric).

### Environment variables

1. Start with the template: `cp .env.example .env`.
2. Mandatory values:
   - `OPENAI_API_KEY`
   - `REALTIME_PORT` (default `4001`, used by `realtime-server.js`)
3. OpenAI model selection:
   - `REALTIME_MODEL` – primary Realtime model (`gpt-4o-mini-realtime-preview` by default).
   - `REALTIME_MODEL_PREMIUM` – optional premium Realtime model (`gpt-4o-realtime-preview` by default; reserved for future tiering).
   - `REALTIME_VOICE` – voice used by the Realtime audio responses (`alloy` by default, can be `ash`, `ballad`, `coral`, `echo`, `verse`, etc.).
   - `EMBEDDING_MODEL` – used for KB ingestion, RAG, and scope detection (`text-embedding-3-small` by default).
   - `TRANSCRIPTION_MODEL` – used by `/api/transcribe` for server-side STT of user audio (`gpt-4o-mini-transcribe` by default).
4. Frontend audio tuning (lab view):
   - `NEXT_PUBLIC_ASSISTANT_PLAYBACK_RATE` – playback speed for assistant audio (default `1.05`; `1.0` = neutral).
   - `NEXT_PUBLIC_VAD_VOICE_THRESHOLD` – minimum RMS energy treated as voice (default `0.008`).
   - `NEXT_PUBLIC_VAD_SILENCE_MS` – silence duration in ms to close a user utterance (default `500`).
5. Optional but recommended:
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
2. Generates embeddings with the configured `EMBEDDING_MODEL` (default: `text-embedding-3-small`).
3. Writes `knowledge/items.json` + `knowledge/vectors.json`.
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

- Deploy the Next.js app wherever you normally host (Vercel, Render, custom Node server). Ensure `/api/scopes`, `/api/transcribe` and any `/api/tools/*` routes are reachable over HTTPS.
- Deploy `realtime-server.js` as a standalone Node process (e.g., PM2, Fly.io, ECS). Expose the WS port securely and, if needed, sit it behind an auth or session layer.
- Store `.env` secrets using your platform’s secret manager. Never bake API keys into frontend bundles.
- Before each deploy:
  1. Commit KB changes and rerun `npm run build:kb`.
  2. Verify Pinecone synchronization (check logs for “Syncing … vectors”).
  3. Smoke-test `npm run dev:all` locally to confirm tools, speech, and KB lookups behave as expected.
- Monitor both processes: logs from `/lab` should show tool usage, while `realtime-server.js` logs every OpenAI event to help debug failures.

Following the checklist above keeps deployment repeatable and documents the requirements (OpenAI credentials, Pinecone index, tool endpoints) for anyone onboarding to the project.

## Roadmap & Voice-Agent Parity

- **Fine-tuned barge-in & turn-taking:** The current implementation relies on a lightweight VAD and `response.cancel` for barge-in. To get even closer to production contact-center behavior, you may want to tune thresholds per locale and add more telemetry around turn detection.
- **Session identity & auth:** Introduce per-session IDs, auth tokens, and logging so multiple clients can connect safely to the realtime bridge.
- **Vector DB hardening:** Switch from local JSON fallback to persisted vector DB only, add filters & metadata facets, and monitor drift between KB versions and Pinecone.

> Tooling/function calling support already ships today: just add entries to `config/tools.json` and wire the corresponding handler (or API proxy) so `realtime-server.js` can fulfil tool invocations.
