# AI Workflow

I built this assessment using **Claude Code** as an implementation agent inside a process I
designed: written project rules, explicit scope, verification against the running app at every
layer, and an independent review gate before anything was committed.

I kept for myself the work that shouldn't be delegated: interpreting requirements, making
architecture and dependency decisions, defining acceptance criteria, and judging evidence. The
agent handled the rest: implementation, terminal work, and first-pass verification.

## 1. Toolchain

| Tool | Role | Rationale |
|---|---|---|
| **Claude Code** (VS Code extension, Claude Haiku 5.5/Sonnet 5.5) | Implementation, shell work, verification | It works against the real repo and runtime. It can read the *installed* library docs, run `curl`, tests and builds, and drive a browser, so its output is grounded in the actual environment rather than training data. |
| **`CLAUDE.md`** | Persistent project contract | Holds the architecture boundaries, non-negotiables and verified version notes. Every step, and the review subagent, reads the same rules, so decisions don't drift between sessions. |
| **Skills** | `/code-review` (independent review subagent), `run` (drives the live app) | Encodes repeatable workflows as tools instead of re-prompting them each time. |
| **Persistent memory** | Standing preferences (git workflow, provider, UI library) | Decisions made once stay in force for the whole project. |

## 2. Operating model

The process is built around one assumption: **an agent's output is a claim, not a result, until
it's verified against the running system.**

1. **Spec before code.** The agent restates the requirements and proposes a phased plan. I review
   it before implementation starts. A misread requirement is the most expensive bug, and a
   restatement is the cheapest way to catch it.
2. **Context engineering over prompting.** Rules, constraints and verified facts live in
   `CLAUDE.md` and memory, not in individual messages. That keeps behaviour consistent across
   long sessions and across agents.
3. **Scope is an explicit constraint.** Agents optimise for robustness by default and will add
   things nobody asked for. Unrequested work is removed, and the decision is recorded so it
   doesn't come back.
4. **Evidence-based acceptance.** A layer is done when it's proven against the live app: `curl`
   for the API, real questions for the chat, a headless browser for the UI. "It compiles" is not
   evidence.
5. **Separate builder and reviewer.** Review runs in a fresh-context subagent that doesn't share
   the implementing session's assumptions.
6. **One clean commit.** Work is staged rather than committed incrementally. It goes through a cleanup gate and is committed once, ensuring the branch contains only finished work. This approach was specific to this small MVP, as I wanted to keep the process simple and maintain control over the changes. For larger or more complex tasks, I would commit changes incrementally and amend commits when necessary. The approach ultimately depends on the scope and nature of the work.

## 3. Execution

### Phase 0: Requirements and plan

I gave the agent the full brief and required three things before any code: a restatement of the
requirements, a phased plan, and a list of open questions.

The resulting plan was a dependency-ordered chain: **data → REST API → UI → tool-calling chat →
tests → docs**. Because this document carries 30% of the grade, it was planned as a first-class
deliverable rather than an afterthought. Five open questions (provider and key, branch name, fork
and push permissions, time budget, stack) were resolved before implementation began.

### Phase 1: Constraints and stack decisions

I set three constraints up front: **zero cost**, **low latency**, and **no framework unless it
earns its place**.

| Decision | Choice | Reasoning |
|---|---|---|
| LLM provider | Gemini, Google AI Studio free tier | Chosen after checking *current* free-tier offerings live. Free tiers change faster than any model's training data. |
| Orchestration | Vercel AI SDK, not LangChain | Streaming, tool calling and the React `useChat` hook are built in. LangChain would have added an abstraction layer with no capability this app needs. The trade-off is documented in the README. |
| UI | shadcn/ui + AI Elements | Vendored, owned components from Vercel's ecosystem instead of hand-rolled chat UI. |
| Secrets | Git-ignored `.env.local`; private material in `.local/` | Staged files are checked before every commit so neither, nor the database, can reach git. |
| Commits | Stage only, single final commit | Keeps history clean and lets the cleanup gate see the whole change at once. |

The architectural non-negotiables were written into `CLAUDE.md`:

- **The model reaches data only through tools; no dataset in the prompt.** This keeps the context
  small and the cost flat as data grows. Numbers are computed by queries rather than generated by
  the model, and answers stay grounded in the current state of the database.
- **Tool output is bounded.** Grouped stats are capped so a single tool call can't flood the
  context window.
- **Responses stream.** Perceived latency matters more than total latency in a chat UI.
- **Verified version notes.** Next.js 16 and AI SDK v7 are newer than the model's training data,
  so the agent was directed to the installed docs (`node_modules/next/dist/docs`,
  `node_modules/ai/docs`) as the source of truth.

### Phase 2: Implementation with per-layer verification

Each layer was accepted only after verification against the running app before the next one was
built on top of it. That ordering matters: a defect found in the API layer costs minutes, while
the same defect found through the chat UI costs a debugging session across three layers.

### Phase 3: Independent review

The `/code-review` skill ran as a forked subagent with its own context. It reported **10
findings**, all of which I triaged and fixed with regression tests (unit tests went from 16 to
19). Representative findings:

| Finding | Why it mattered |
|---|---|
| Stop didn't cancel the server-side model calls | Cancellation wasn't propagated to the provider, so abandoned requests kept consuming free-tier quota. |
| A tool hint misled the model when a *different* filter emptied the result | The model received a wrong explanation for an empty result and passed it on to the user. |
| Grouped stats weren't capped | Violated the bounded-output rule in `CLAUDE.md`; an unbounded tool result inflates tokens and latency. |
| LIKE wildcards weren't escaped | User input containing `%` or `_` silently changed query semantics. |
| Deleting every game re-seeded the demo data on restart | The app couldn't tell "new database" apart from "user deleted everything". |

These are the kind of bugs that pass tests and happy-path demos, which is exactly why the reviewer
needs a context separate from the implementer's.

### Phase 4: Pre-commit hardening

Before the single commit, I ran a cleanup gate: an unused-code scan (knip) plus manual review of
every dependency and file.

- **~1,800 lines of unused vendored code removed.** AI Elements' prompt input went from ~1,400
  lines to ~160, keeping only the six pieces the chat uses. Vendored code is owned code, and owned
  code should be trimmed to what's used.
- **3 orphaned UI components and 3 packages removed** (`cmdk`, `nanoid`, `@streamdown/code`).
  Earlier trimming of unused markdown plugins had already removed ~130 transitive packages.
- **A documentation bug caught.** The README claimed Node 20.9+, but `better-sqlite3` 13 and
  AI SDK 7 require Node 22. I set `engines` to `>=22.12`, added `.nvmrc`, and corrected the
  README, so the runtime requirement is enforced rather than just documented.

## 4. Agent failure modes and how the process caught them

### Scope creep: an unrequested fallback provider

Asked for "the best free model", the agent also wired in **Groq as a second provider**, with an
env-var switch, extra config and extra docs. The intent was reasonable (free tiers are volatile),
but within a 2–3 hour budget it meant more code, more configuration and more surface for bugs, in
exchange for resilience this POC doesn't need.

I removed it completely (package, config, docs) and recorded "Gemini only" in persistent memory
so it wouldn't reappear later in the session.

**Takeaway:** agents fill unstated scope with robustness. Scope has to be stated, and the decision
persisted.

### Stale model knowledge: caught by live verification

- The agent's first default, `gemini-2.5-flash`, returned **404** on the live API ("no longer
  available to new users").
- The next candidate, `gemini-3.8-flash`, answered correctly but began failing under repeated test
  questions. The server log showed **HTTP 429s**: its free tier allows **5 requests/min and
  20/day**, and every tool-calling step is a separate request, so a single multi-step question can
  consume several. The UI showed only a generic error, because the AI SDK wraps provider errors in
  a `RetryError`.

The fix addressed the cause, not only the symptom:

- **Error surfacing:** unwrap the `RetryError` and show an actionable message ("rate limit reached,
  wait ~14s").
- **Quota protection:** set `maxRetries: 1`, so automatic retries don't burn the remaining quota.
- **Model selection by evidence:** re-ran the same six test questions on `gemini-3.5-flash-lite`.
  All answers were correct, first token arrived about 2x faster, and there were no quota errors. It
  became the default, with the reasoning documented in the README and in `src/lib/ai/model.ts`.

**Takeaway:** because verification against the live app was mandatory at every phase, stale model
knowledge surfaced in minutes during development instead of in a reviewer's hands.

## 5. Subagents, parallel agents and worktrees

- **Subagent: used, for review.** Its value comes from context isolation. A reviewer that didn't
  write the code doesn't inherit the author's blind spots, which is why it found real bugs the
  main session had missed. Findings were triaged in the main session, and each fix shipped with a
  regression test.
- **Parallel agents and worktrees: deliberately not used.** The work was a strict dependency chain
  (schema → repository → API and tools → UI) in a small codebase. The main risk was correctness
  against brand-new library versions, not throughput. Parallel worktrees would have added merge and
  context-sync overhead with no real time saved.
- **When I would use them:** on a follow-up with independent tracks, for example chat-history
  persistence in one worktree and server-side table pagination in another, each with its own agent
  and a shared `CLAUDE.md` contract.

## 6. Principles for reliable AI-assisted engineering

- **Process gates, not trust:** understand → plan → resolve questions → build → verify →
  independent review → clean up → commit.
- **Ground truth over model memory:** read installed docs and probe live APIs. Fast-moving
  libraries and free tiers make training data unreliable by default.
- **Persist decisions:** write them in `CLAUDE.md` and memory so they survive across steps and
  agents.
- **Accept evidence, not claims:** test output, `curl` responses, server logs and screenshots.
- **Lean scope and dependencies:** own vendored code, trim it, and fix lint issues at the root
  rather than disabling rules.
- **Secrets hygiene by default:** private material in git-ignored locations, staged files checked
  before every commit.