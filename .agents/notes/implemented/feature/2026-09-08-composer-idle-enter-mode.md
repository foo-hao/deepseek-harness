# Agent Note: Configurable idle Enter behavior

Status: implemented

English | [中文](2026-09-08-composer-idle-enter-mode.zh.md)

## Problem

Users who compose multiline instructions need an explicit choice between plain Enter sending a message and inserting a line break. The running-agent Queue/Steer preference controls a separate interaction.

## Decision

The conversation settings own an idle Enter mode with Send as its default and Newline as the alternative. The Host settings service persists the choice. The settings row and resident composer subscribe to the same preference source.

The Lexical command handler first handles Shift+Enter, IME composition and menu arbitration. Editable, idle Newline mode delegates plain Enter to the editor line-break handler. Cmd/Ctrl+Enter submits while idle. Busy input continues to resolve Queue/Steer through the submission policy; locked and adjudicating input retains its existing guards. The newline placeholder preserves the action prompt and adds the shortcut explanation.

## Alternatives considered

Changing the default to Newline would change the ordinary send gesture for existing users. A single idle/busy preference would couple multiline composition to running-agent delivery. Separate choices preserve both workflows. The setting is implemented in the conversation owner, which already owns the editor keymap and busy preference; an ecosystem implementation depends on an agreed client extension contract.

## Consequences

Multiline writers can select native line breaks while retaining an explicit accelerated send gesture. Maintenance includes validating settings persistence, live preference updates, editor draft synchronization, IME and menu precedence, locked input, and the idle/busy keybinding combinations.
