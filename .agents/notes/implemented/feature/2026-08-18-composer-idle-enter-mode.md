# Agent Note: Composer idle-Enter mode (Send | Newline)

Status: implemented

English | [中文](2026-08-18-composer-idle-enter-mode.zh.md)

## Problem

The composer's plain Enter always submitted while the addressed agent was idle; only Shift+Enter inserted a newline. Users coming from chat-style composers expect idle Enter to break the line and Cmd/Ctrl+Enter to send, and the only way to get that behavior was patching the shipped client bundle, which does not survive desktop upgrades.

## Decision

`ui-conversation` gains a second durable preference: `ui-conversation.enterMode` with values `send` (default, current behavior) and `newline` (idle plain Enter falls through to the native newline insertion). The `ComposerSubmissionPolicy` owns an `enterMode` snapshot store beside `busyEnter`; the Host-backed settings section adopts and writes it through the existing scope, the Settings row renders a second selector, and `InputBar` reads the live snapshot in its Enter branch before `preventDefault`. When an available idle composer uses `newline`, `InputBar` preserves its active action prompt and appends the plain-Enter and Cmd/Ctrl+Enter meanings to the textarea placeholder; the hint therefore follows live preference changes without replacing Hero, Plan, or owner-provided guidance. Busy, locked, adjudicating/submitting, and accelerated Enter keep their existing gestures, and Shift+Enter stays the unconditional newline chord. The persistence boundary this preference rides is the [Host-backed preferences decision](../bug-fix/2026-08-06-host-backed-web-preferences.md).

## Alternatives considered

- **A runtime patch of the compiled client bundle.** Loses every change on desktop upgrade and bypasses the settings seam; the local patch approach this decision replaces.
- **A separate settings namespace in a new plugin.** The Enter modes belong to the conversation settings document the policy already adopts; a second namespace duplicates the scope wiring without a second owner.
- **Defaulting `enterMode` to `newline`.** A non-breaking default preserves shipped behavior; the preference is one click for users who want the chat-style chord.

## Consequences

The settings row shows two selectors; the durable document carries one additional field whose default keeps existing documents valid. The idle-newline branch returns before `preventDefault`, so native repeat inserts multiple newlines like a plain textarea — intentional. Newline's shortcut guidance appears only while the idle composer can accept the advertised chord; Send mode, busy input, and unavailable composers keep their existing placeholders. The preference affects the idle gesture only; queue/steer busy behavior and the whole-queue steer chord are unchanged.

## Testing

Policy adoption and durability cases extend `submission-policy.client.spec.ts`; the InputBar suite covers live placeholder changes, preserved action prompts, idle-newline fall-through, busy Queue/Steer mapping and accelerated sends under Newline, and the locked-composer swallow; the second selector extends the Settings-row suite. The keyless Web settings scenario captures the added row and proves that both Enter preferences survive reload and a second Host on another port.
