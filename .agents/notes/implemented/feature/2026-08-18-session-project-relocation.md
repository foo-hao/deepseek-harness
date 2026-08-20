# Agent Note: Relocate a session to another project

Status: implemented

English | [中文](2026-08-18-session-project-relocation.zh.md)

## Problem

A session is attached to the workspace identified by its canonical working directory. The workspace browser could fork, rename, or archive a session, but it could not move an existing conversation into the project where the work now belongs. Starting a replacement session lost the conversational branch, while leaving the original in place kept the workspace list misleading.

## Decision

Session relocation uses the existing fork seam with an optional target working directory. The host resolves the target to a canonical workspace, creates that workspace when needed, and stamps the child session header with the target directory. The client runtime carries the override through the session manager, and the workspace row action opens a project picker before requesting the fork.

After the child session opens successfully in the target project, the source session is archived. This gives the interaction move semantics while retaining the original event log and allowing it to be restored through the existing unarchive path. A failed fork leaves the source session active and selected.

## Alternatives considered

- **Rewrite the source session header.** Session identity and replay depend on the immutable header, so changing its working directory in place would weaken persistence guarantees.
- **Copy persistence files directly.** File-level copying would bypass the session service, workspace resolution, and storage backends that already own fork semantics.
- **Keep both sessions visible after the fork.** This preserves both branches in the main lists, but presents a relocation as a duplicate and leaves the source project cluttered.

## Consequences

The relocated conversation receives a new session identifier in the destination project, while the archived source remains recoverable. Title increment behavior follows the normal fork path. Workspace resolution stays host-owned, and the UI only provides the requested target directory and coordinates the successful handoff.

## Testing

Workspace row tests cover the new move action without opening the source session. Runtime and host contract coverage exercise the optional working-directory override, and workspace browser fixtures include the relocation callback. The archive step runs only after the destination session has been created and opened.
