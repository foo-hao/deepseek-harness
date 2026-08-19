# Agent Note: Interactive SIGINT exit confirmation

Status: implemented

## Problem

A stray Ctrl+C in an interactive `dsh` terminal immediately began graceful teardown of a long-lived surface (`dsh web`) and its in-flight agent sessions. There was no way to recover from the accidental interrupt.

## Decision

The launcher gains a confirmation gate (`apps/cli/src/exit-confirmation.ts`) layered above the existing `ProcessShutdown` controller. In an interactive terminal (`process.stdout.isTTY`), the first SIGINT prints a prompt and arms a three-second window instead of draining; a second SIGINT inside the window proceeds (exit 130), and the window expiring cancels. SIGTERM always bypasses confirmation (exit 0), and non-TTY processes keep the single-signal behavior. The existing drain-then-force escalation inside `createProcessShutdown` is unchanged.

## Consequences

`profile-boot.ts` wires the gate into the SIGINT/SIGTERM handlers before `shutdown.interrupt`. The headless one-shot keeps the confirmation when run under a TTY (a PTY e2e test now sends three signals: confirm, drain, force). `process-shutdown.spec.ts` is untouched.

## Testing

`exit-confirmation.spec.ts` covers arm/proceed/expiry/non-interactive/consumed/dispose; `headless-shutdown.e2e.ts` now drives confirm -> drain -> force.
