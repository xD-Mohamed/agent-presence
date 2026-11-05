# Agent Presence Implementation Plan

> Execute inline using superpowers:executing-plans; use test-driven-development
> for lifecycle and privacy behavior, then request a fresh whole-change review.

**Goal:** Add Claude Code with Clawd and rename the product to Agent Presence.
**Architecture:** Independent metadata readers feed a sticky provider selector;
activity.js remains the sole public payload builder.
**Tech stack:** Node ESM >=22.18; no runtime dependency; sharp for artwork only.
**Spec:** ../specs/2026-11-05-agent-presence-design.md

## Global constraints

No credentials, prompt/output text, full paths or session identifiers in payloads.
No assistant setting writes. Keep compatibility installation identifiers.

## Review focus

Partial/rotated/oversized transcript lines; sidechain and SDK exclusion;
concurrent provider completion; Node-based CLI detection; restored custom homes.

## Tasks

- [x] Add failing Claude transcript and provider-selection tests; verify failure.
- [x] Add ClaudeState/ClaudeSource and parameterize the bounded JSONL tail.
- [x] Test provider-aware process detection and implement separate idle histories.
- [x] Test Claude payload identity and persistent homes; wire CLI, artwork selection.
- [x] Create Clawd animation assets; inspect render and GIF metadata.
- [x] Rebrand package/docs and keep compatibility IDs; run full tests and pack audit.
- [x] Review, fix substantive findings, publish changes and rename repository.

## Execution notes

The existing checkout is a fresh clone with no user edits. Changes execute inline.
The name is an implementation choice delegated by the user's request. Native
Clawd-style code artwork avoids an image-generation dependency in the build.

Verification: 50 local unit tests pass. Independent review completed after interruption/compaction and Windows MSIX detection fixes. Artwork pinned to commit 8a4eaa3894407882e74b017fa50ffca3f0c96f93. GitHub run 42082488810 passed all five jobs: Linux/Windows on Node 22.18 and 24, plus direct GitHub npx installation/update/stop/start/uninstall. The workstation publisher was not interrupted. Live VS Code and a full desktop reboot remain unverified.
