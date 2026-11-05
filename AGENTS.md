# Agent Presence

Node ESM CLI; Node >=22.18 for read-only node:sqlite. Runtime has no network calls except local Discord IPC; Discord fetches public artwork URLs. sharp is for maintainer artwork builds only.

- `npm test`: synthetic SQLite lifecycle/privacy tests and fragmented IPC decoding.
- `npm start -- --dry-run --once`: print only the exact public payload.
- `node scripts/build-artwork.js <sprite-directory>`: create and verify v2 pet GIF loops.
- `npm pack --dry-run`: audit distributable files.
- Never read auth.json; never publish prompts, titles, output, full paths, plan/usage/account data. Model, effort and numeric tracked Git diff totals are explicitly allowed.
- `localCwd` is internal only; only activity.js may assemble the public payload.
- Prefer real projects over generated projectless chats. Within that tier keep the oldest active thread selected until it completes; no rotation. Resumed projects preempt projectless chats. One OS-held loopback listener prevents competing publisher processes.
- `activity.js` is the egress allowlist. Keep metadata separate.
- Projectless generated folder names are private; omit them. Ordinary projects use basename only.
- SQLite source uses state_5.sqlite + thread_history_1.sqlite. Bounded JSONL fallback covers local Desktop, VS Code and CLI session formats; exclude subagents and never retain payload text. Schemas are private and must fail closed on drift. Remote bridging is not implemented.
- Installer is global per-user. Windows 0.3.6 uses LocalAppData/Programs/Codex Discord RPC and a least-privilege interactive Task Scheduler logon task (schtasks.exe + XML) targeting a GUI .NET launcher compiled from src/windows-launcher.cs by csc.exe at install. Keep CreateNoWindow + UseShellExecute=false; drain both output streams; no console flash. Track source-hash-named executables in the install record and remove them with bounded async retries after stop. Import legacy options/pet only when no new record exists; never overwrite/delete legacy runtime files. Remove only identified legacy launchers. Tests exercise migration, real task launch after stop, update, and uninstall; no reboot tested. Keep unrelated files/tasks and remembered pet. Codex MSIX child processes may see LocalCache instead of physical AppData; verify actual installs from an independent Windows process. Task processes can retain cwd briefly after stopping; use bounded retry for temporary-test cleanup.
- Disabled pets use the last remembered supported pet, then Codex by default. Never change Codex's own pet setting.
- Idle presence is separate from task expiry: liveness.js probes executable paths (never command arguments/titles) every five seconds and retains the last observed session metadata in memory only while that surface remains open. Confirmed closure clears presence; unknown process state does not invent Idle. Keep transitions and no-process behavior covered by liveness.test.js.
- Shared Discord Application ID is public, not a credential. Never use another project's ID.
- Built-in artwork remains third-party OpenAI artwork, outside the MIT source-code license. Current animation URLs use artwork/natural with the native Codex frame delays. The ChatGPT badge uses official vector art with transparent padding for a smaller footprint.
- `.codegraph/` is local only. Update docs when compatibility changes.

## Claude Code and product identity (0.4.0)

- `claude.js` reads parent `projects/*/*.jsonl` transcripts. Respect `CLAUDE_CONFIG_DIR` / `--claude-home`. No hooks, auth/config reads or assistant writes. Known entrypoints: cli, claude-desktop, claude-vscode, vscode; absent means legacy CLI. Exclude SDK and sidechains.
- `rollouts.js` exports the bounded Tail used by both providers. Claude also expires by recognized event timestamps, so metadata-only writes cannot revive stale work.
- `presence.js` selects by provider plus session ID, preserving real-project priority and sticky oldest-active selection. Idle memories are separate per provider. `CLI?` means Node may host a legacy Claude CLI: permit fresh metadata but never invent Idle.
- `companion.js` selects Clawd for Claude; Codex pet memory stays independent. `activity.js` switches name and omits the ChatGPT badge for Claude.
- Product/package/repository: Agent Presence / agent-presence. Keep the old binary alias, install IDs/paths, task names and single-instance protocol for upgrade compatibility. Discord application ID stays unchanged; its registered name is a separate portal setting.
- Clawd builder: `node scripts/build-clawd.js`; decode the pinned JSON sprite data in `artwork/claude-native/source`, never execute upstream TypeScript. Preserve all 25 source sequences / 1,093 frames, 12fps via cumulative centisecond rounding, and transparent unclipped pixels. Three mirrored movement variants make 28 GIFs. `node scripts/preview-clawd.js` rebuilds the README gallery. Pin the artwork base to an immutable published commit. `src/clawd.js` maps public states to allowed clips and rotates variants every 30 seconds; Codex and custom nine-file artwork mappings stay unchanged. Artwork is Anthropic-owned and excluded from MIT; retain NOTICE and provenance.
- Startup integration requires an isolated Windows host with no active publisher. Never stop a user's running publisher just to run tests. CI covers that path.

## Direct Windows installation (0.5.0)

- `install.ps1` is the primary Windows path: HTTPS ZIP, runtime-file allowlist extraction, no npm/Git/SSH/cache dependency. Never recommend changing execution policy; Windows npm examples use `npx.cmd` and HTTPS archives.
- Reuse Node >=22.18 after an in-memory SQLite probe, or download private Node 24.14.1 x64/ARM64 with pinned official archive SHA-256. Determine architecture through RuntimeInformation; apps can omit processor environment variables. Retain private Node for reinstalls; never alter system Node or PATH.
- Staging is under LocalAppData/AgentPresence/InstallCache with a GUID leaf. Recursive cleanup must verify the absolute root and leaf. A per-user OS mutex prevents overlapping bootstrap/control operations.
- `test/bootstrap.test.js` runs safe mocked-network PowerShell 5.1 checks. `scripts/test-bootstrap-install.ps1` is CI-only: no Node/npm/Git in PATH, private runtime, saved-option upgrade, stop/start/uninstall. Never run it on the active publisher host.
- CLI help/install lazy-load SQLite, avoiding irrelevant experimental warnings during installation.
