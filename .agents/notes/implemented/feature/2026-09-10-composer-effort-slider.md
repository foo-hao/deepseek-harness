# Agent Note: Direct composer effort adjustment

Status: implemented

English | [中文](2026-09-10-composer-effort-slider.zh.md)

## Problem

Users adjusting reasoning effort between tasks need a directly visible control beside the selected model. The available choices and their names are owned by the model adapter.

## Decision

The model control includes a native discrete range with one stop per advertised effort choice, including the provider-default choice when the model offers it. The control appears when at least two choices exist. The model menu continues to expose the same choices through its existing interaction.

Pointer interaction previews locally and commits once on release or focus loss. Pointer cancellation discards the preview. Model identity and choice changes remount the local interaction, while a new authoritative value or blocked state clears the pending drag. Keyboard changes use native range navigation and submit through the existing session selection callback. In-flight selection uses an accessible disabled state while preserving keyboard focus; owner-locked input uses the native disabled state.

## Alternatives considered

Replacing the existing menu would broaden the interaction change. Keeping the menu alongside the range provides a direct control while preserving the established selection workflow. A continuous numeric budget would introduce values outside the adapter contract; the range selects exact advertised values in their supplied order.

## Consequences

Users can adjust effort directly with pointer and keyboard input. The Host selection remains authoritative, and selection errors use the existing feedback. Verification covers preview and commit ordering, cancellation, owner changes, locked and pending states, advertised value mapping, keyboard focus, and persisted selection in a real browser.
