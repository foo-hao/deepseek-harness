# Agent Note: Composer thinking-intensity slider

Status: implemented

## Problem

The composer's model seat put effort selection behind a second drill-in menu: opening the model trigger, then the effort row, then the level list took three gestures, and the committed level only surfaced as a caption suffix squeezed into the model trigger. The adapter-owned reasoning-effort levels were already the single source of truth on the session `ModelDirectory`; only the presentation made them slow to reach.

## Decision

`ModelSelect` replaces the effort pane with an always-visible discrete slider beside the model trigger: one horizontal track with a stop per adapter-owned effort level (plus the provider-default entry when the adapter sets no model default), shown only while the current model exposes reasoning metadata. Pointer drag/click and ArrowLeft/ArrowRight keyboard steps commit through the same per-session directory `select` verb as the model list, so a rejected effort selection still announces through the composer Toast.

Presentation polish: reached stops render filled, the track brightens on hover, the thumb scales on hover and again while dragging, the keyboard focus ring matches the trigger's, and all motion is guarded by `prefers-reduced-motion`. The menu is now a single-level model list; locale keys that only the removed pane used (`trigger.ariaEffort`, `menu.model`, `action.reload`, `empty.efforts`) are deleted and `menu.aria` reads as the model-list label.

## Alternatives considered

- **Keep the drill-in effort pane.** The status quo minimized composer width but buried the most-tweaked session control behind three gestures; it lost on reachability.
- **Single-level radio group inside the model menu.** One fewer gesture than the pane, but effort still hides behind the trigger and the committed level is not visible at a glance; the slider shows it always.
- **Text select or segmented control.** A second dropdown keeps the same hidden affordance problem; a segmented control cannot hold the adapter-declared level count, which ranges from one to several plus the provider-default entry.

## Consequences

The trigger label no longer carries the effort; the slider's `aria-valuetext` and value label own the current level. The slider is inert (not focusable) while the seat is locked, and absent entirely for models without reasoning metadata. The effort feature itself — adapter-owned levels, provider default, per-model defaults — is unchanged and remains upstream-identical; only the web presentation differs.

## Testing

`ui-model-selection/tests/model-select.client.spec.tsx` now drives the slider: committed stops, keyboard stepping, provider-default position, lock inertness, rejection toast, and absence without reasoning metadata. The keyless web scenario `apps/web/tests/declared-reasoning.e2e.ts` steps the slider to a declared level and re-records its golden aria snapshot.
