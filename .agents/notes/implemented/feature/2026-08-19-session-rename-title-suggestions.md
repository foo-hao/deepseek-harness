# Agent Note: Session rename with whole-session AI title suggestions

Status: implemented

English | [中文](2026-08-19-session-rename-title-suggestions.zh.md)

## Problem

The web rename dialog only offered a free-text field; finding a session later meant typing a title by hand. Codex-style rename surfaces generate several concise candidate titles from the whole conversation and let the user click one.

## Decision

`SessionTitleService` gains a read-only `suggest()` that asks the registered title provider for several candidates (deduplicated, normalized, never committed). `SessionTitleProvider` gains an optional `suggest` method with a single-`generate` fallback. The LLM base (`session-title-llm`) adds `generateSessionTitleSuggestionsWithLlm`, which frames all messages once and asks for `suggestCount` titles one-per-line, capped by `suggestMaxOutputTokens` (both optional config with defaults 1 / 256). The suggestion request reuses the log-only `session/title-llm-request` event so it stays model-visible<->logged.

A new RPC `session.suggestTitles` (request `{ sessionId }`, response `{ titles: string[] }`) rides the existing apiproxy chain (sessions.ts, sessions.schema.ts, rpc-map.ts, fetch/handler.ts, fetch/client.ts, api-proxy.ts). The client exposes `ISession.suggestTitles()` / `Session.suggestTitles()`, and the `ui-workspace` rename dialog fetches suggestions on open and renders them as clickable chips that prefill the draft.

## Alternatives considered

- **Automatically replace the title when the dialog opens.** This shortens the interaction, but turns an advisory operation into an unexpected write and can overwrite a useful current title.
- **Generate from the first prompt only.** First-prompt generation is cheaper, but misses the direction and result of a conversation that evolved after it began.
- **Request each candidate separately.** Independent calls simplify parsing, but increase cost and latency while producing less coherent alternatives.

## Consequences

Suggestions are advisory and read-only: they never append a `session/title` event, never pin the title, and never disturb the automatic-generation state machine. A suggestion failure shows a quiet retry and never blocks manual rename. Both title provider plugins register `suggest` (always whole-session, regardless of first-prompt vs all-prompts cadence).

## Testing

`session-title/tests/suggest.spec.ts` covers dedupe/fallback/empty/read-only; `session-title-llm/tests/llm.spec.ts` covers framing, per-line parsing, capping, and whitespace-only output; `ui-workspace/tests/rename-assembly.client.spec.tsx` covers chip render + click-to-prefill. The apiproxy fetch-carrier/client-handler test mocks gained the new method.
