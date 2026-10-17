@AGENTS.md

# Indie Games Dashboard — project rules for AI agents

Internal dashboard (CRUD over an indie-games catalog) + an AI chat that answers questions
about the catalog via **tool calling** and **streaming**.

## Commands
- `npm run dev` — app on http://localhost:3000 (DB auto-created + seeded in `data/`)
- `npm test` — Vitest unit tests (repository + AI tool logic, in-memory SQLite)
- `npm run typecheck` / `npm run lint` / `npm run build` — all must pass before committing
- `npm run db:reset` — delete the local DB so it is re-seeded on next start (stop the server first)

## Architecture (keep these boundaries)
- `src/lib/games/schema.ts` — Zod schemas + types. Single source of truth for validation
  (server routes *and* the client form).
- `src/lib/games/repository.ts` — **the only place that runs SQL.** API routes, the server
  component and AI tools all go through it.
- `src/lib/games/database.ts` — schema + one-time seed (`PRAGMA user_version`).
- `src/lib/db.ts` — server-only connection singleton.
- `src/app/api/games/**` — thin REST handlers: parse (Zod) → repository → JSON (`src/lib/http.ts`).
- `src/lib/ai/` — Gemini model config, system prompt, tool definitions (handlers are plain,
  unit-tested functions wrapped with `tool()`).
- `src/app/api/chat/route.ts` — streaming chat endpoint.
- `src/components/dashboard`, `src/components/chat` — app UI. `src/components/ui` (shadcn/ui) and
  `src/components/ai-elements` (AI Elements) are vendored; adapt them when needed, keep them lean.

## Non-negotiable requirements
- The chat answers via tools. **Never put catalog rows in the system prompt.**
- Tools return compact JSON, cap result sizes, and return `{ error }` instead of throwing.
- The model never does arithmetic: differences/percentages/ties are computed in tool code
  (see `compareGames`), and the prompt requires every claim to be backed by tool results.
- Chat responses stream to the UI.

## Version notes (verified against `node_modules/*/docs` — don't rely on memory)
- Next.js 16: route `params` is a `Promise` → `await ctx.params`.
- Next.js 16 `cacheComponents`: call `await connection()` before sync SQLite reads in server
  components and wrap them in `<Suspense>`, otherwise they are prerendered at build time.
- AI SDK v7: `stopWhen: isStepCount(n)`, `instructions` (not the deprecated `system`), and
  `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })`.
  Provider errors arrive wrapped in `RetryError` → inspect `error.lastError`.
  Client tool parts are `tool-<toolName>` with states
  `input-streaming | input-available | output-available | output-error`.
- Gemini free tier: quotas are per model (per minute and per day) and each tool step is one
  request. Default model is `gemini-3.5-flash-lite` (`gemini-2.5-flash` is closed to new keys).
- Dev HMR: cache only the DB *connection* on `globalThis`, never objects built from module code.

## Conventions
- TypeScript strict, no `any`. Validate all external input (HTTP bodies, query params, tool
  inputs) with Zod.
- Money is USD stored as a number; format with `Intl.NumberFormat` in the UI only.
- Verify chat changes with real questions against the running app (see README examples).
