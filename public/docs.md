# Voice Agent – Documentation

## Overview

This project is a **voice-first assistant** built on top of **Next.js** and the **OpenAI Realtime API**. The assistant can:

- Hold natural, speech-to-speech conversations.
- Use tools (function calling) to fetch business data (e.g., bookings, availability, weather).
- Enrich answers with a company knowledge base (RAG).
- Be driven via a single shared React hook, reused across views.

The main UX lives in `/chat`, where you can:

- Start/stop a voice call.
- Talk to the assistant via the mic.
- Type messages when needed.
- Inspect a debug panel with scopes, tools, and config.

## Architecture (high level)

```text
User (mic / speakers)
   ↓
Next.js frontend (chat view + hook)
   ↓
WebSocket bridge (realtime/server.ts)
   ↓
OpenAI Realtime (gpt-4o-mini-realtime-preview)
   ↓
RAG (Pinecone / local JSON)
   ↓
Tools (bookings, availability, weather, session tools)
   ↓
Realtime → bridge → frontend (audio + transcript)
```

Key components:

- `app/(public)/chat/page.tsx` – main chat/voice UI.
- `lib/voice/useRealtimeVoiceSession.ts` – shared hook that manages:
  - WebSocket to the bridge.
  - VAD (voice activity detection) + barge-in.
  - STT and intent (`/api/transcribe`, `/api/voice-intent`).
  - Scopes (`/api/scopes`) and messages timeline.
- `realtime/server.ts` – Node WS bridge:
  - Configures the Realtime session (`REALTIME_MODEL`, `REALTIME_VOICE`).
  - Loads `config/profile.json`, `config/tools.json`, `config/sanitize.json`.
  - Handles tools, RAG and sanitisation.
- `knowledge/*` – local KB JSON + vectors for RAG.

## Tools & business logic

- Tools are defined in `config/tools.json` with:
  - `name`, `description`, `parameters` (JSON Schema).
  - `kind`: `"business"` or `"session"`.
  - `routes` (for business tools): HTTP method + path under `/api/tools/*`.
  - `ui_command` (for session tools): local commands like `end_call`, `mute_speaker`.
- Business tools are backed by Next.js routes:
  - `lookup_booking` → `/api/tools/bookings/:locator`.
  - `check_availability` → `/api/tools/products/check-availability`.
  - `get_weather` → `/api/tools/weather?city=...` (mock weather).

The bridge forwards OpenAI tool calls to these routes and sends the results back into the Realtime session so the assistant can explain them in natural language.

## Configuration files

- `config/profile.json`
  - `identity`: who the assistant is and what it’s optimised for.
  - `tone_guidelines`: personality, languages, and how to speak.
  - `answer_policies`: how to structure responses (short, clear, non-pedantic).
  - `tool_policies`: explicit rules for when/how to call tools.
  - `escalation_policies`: when to hand over to humans.
  - `safety_rules`: hard constraints (no invented bookings, no secrets, etc.).
- `config/tools.json`
  - All callable tools, both business and session.
- `config/sanitize.json`
  - Regex rules to clean or mask sensitive fragments in assistant text.

These files are hot-loaded by the bridge; when you change them, restart `npm run realtime` so the new instructions and tools are applied.

## Running locally

Use two terminals:

```bash
# Terminal A – Realtime bridge
npm run realtime

# Terminal B – Next.js app (chat + APIs)
npm run dev
```

Or use:

```bash
npm run dev:all
```

and visit:

- `/chat` for the main voice/chat experience.

Make sure `.env` is populated (see `.env.example`) and that `OPENAI_API_KEY` is set.

## Debug & inspection

The chat view has a **Debug mode** toggled via the ellipsis menu:

- Shows:
  - WebSocket, call, mic/speaker, and assistant status.
  - Current scope.
  - Loaded configuration (profile blocks, tools, sanitize rules).
  - System events (tools, scopes, errors).
- The panel is:
  - Floating, draggable, and resizable.
  - Intended to replace the old `/lab` view for most debugging tasks.

## Voice modes

- `NEXT_PUBLIC_USE_VOICE_TRANSCRIBE=true` (default):
  - Voice + text hybrid mode:
    - Transcribes user utterances into chat bubbles.
    - Uses `/api/voice-intent` to classify USER_TURN vs IGNORE.
    - Updates scopes from voice content.
- `NEXT_PUBLIC_USE_VOICE_TRANSCRIBE=false`:
  - “Pure voice” mode:
    - Still uses STT to update scopes and drive tools.
    - Does **not** create user text bubbles from voice.
    - The assistant’s audio and transcript still appear as usual.

## Next steps

- Add real business tools (e.g., your booking/CRM APIs).
- Grow the knowledge base under `knowledge/raw` and rebuild vectors.
- Iterate on `config/profile.json` until the assistant’s tone matches your brand.

This view is intentionally high-level. For deeper internals, check the repo’s `README.md` and the inline documentation in `realtime/server.ts` and `lib/voice/useRealtimeVoiceSession.ts`.

