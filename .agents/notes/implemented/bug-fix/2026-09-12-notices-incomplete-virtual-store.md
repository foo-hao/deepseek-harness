# Agent Note: License lookup skips incomplete virtual-store entries

Status: implemented

English | [中文](2026-09-12-notices-incomplete-virtual-store.zh.md)

## Problem

An interrupted optional dependency installation can leave a version directory containing only an empty node_modules directory. The license generator's prefix lookup reads its manifest before checking the requested version, so an incomplete entry visited before resolution aborts generation even when the requested version is fully installed elsewhere in the store. Directory enumeration order, rather than version age, determines whether lookup reaches that entry.

## Decision

The prefix lookup checks for the candidate manifest before reading it, matching the existing whole-store fallback. Missing candidates allow lookup to continue to a complete prefix entry or a truncated-name entry. Exhausting the store returns undefined so the caller retains ownership of required-package diagnostics. Present manifests are parsed normally, preserving malformed-content errors.

## Alternatives considered

Deleting stale store entries manually repairs one installation but requires contributors to manage package-manager residue. Catching every read or parse error would obscure malformed metadata. Checking candidate presence addresses incomplete entries while preserving validation of existing content.

## Consequences

Optional-install residue can coexist with complete package versions during notice generation. Regression fixtures cover ordinary and truncated complete entries after an incomplete older entry, an entirely absent requested installation, and a malformed present manifest. An additional matrix controls enumeration order for both lower and higher incomplete version labels and for present and absent requested versions; file reads and parsing remain real. Each fixture owns and removes its temporary store.
