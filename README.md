<div align="center">

<img src="artwork/natural/null-signal/review.gif" width="128" alt="Codex companion">
<img src="artwork/claude/clawd/review.gif" width="128" alt="Clawd thinking">

# Agent Presence

**Codex and Claude Code, live on Discord.**

Animated companions · Live activity · Model · Project & Git changes

[![Node.js](https://img.shields.io/badge/Node.js-22.18%2B-43853d)](https://nodejs.org/)
[![License](https://img.shields.io/badge/Source-MIT-blue)](LICENSE)
[![No tokens](https://img.shields.io/badge/Account_tokens-not_needed-8b5cf6)](#privacy)

[Install](#install-once) · [Commands](#commands) · [Compatibility](#compatibility) · [Privacy](#privacy)

</div>

Formerly **Codex Discord RPC**. One background helper follows both assistants.

## Install once

You need **Node.js 22.18+** and the **Discord desktop app** on the same computer as your assistant.

```sh
npx --yes github:xD-Mohamed/agent-presence install
```

Starts in the background now and automatically at login. No Application ID, account token, API key, hooks or per-project setup.

> **بالعربي:** شغّل الأمر مرة واحدة. الأداة هتعرض نشاط Codex وClaude Code على Discord، وتبدّل الشخصية تلقائيًا. مش لازم تفعّل الـpet داخل التطبيق.

This is distributed through GitHub; `npx agent-presence` is not available until an npm registry release is published. The old GitHub repository URL redirects here and the `codex-discord-rpc` executable alias is retained.

To try foreground mode without automatic startup:

```sh
npx --yes github:xD-Mohamed/agent-presence
```

Keep the terminal open; press **Ctrl+C** to stop.

## What appears

```text
Claude Code
Editing code · Claude Opus 4.6
Project: My App  |  +400 −50
⏱ Elapsed time
```

- **Identity:** Claude Code with orange Clawd, or ChatGPT Codex with the selected Codex companion.
- **Activity:** thinking, planning, editing, reading, searching, testing, running commands, waiting, idle, ready or needs attention, as available in local session records.
- **Model:** the model from the session. Codex reasoning effort is shown when available; Claude effort is omitted when unavailable.
- **Project:** only the folder basename; generated Codex projectless folder names are hidden.
- **Git:** staged + unstaged tracked changes against HEAD, refreshed at most every 10 seconds. Untracked and binary files are excluded. After committing, the card shows `Git clean`.

The oldest active real project keeps the card until it finishes, including across assistants. Real projects take priority over projectless chats. There is no rotation; a second publisher cannot compete with the first.

When work finishes, supported open native apps/backends retain an **Idle** card with the last observed metadata. Confirmed closure clears it. Ten minutes without recognized Claude activity expires stale work. Process detection reads executable paths only, never arguments or window titles. Generic VS Code alone does not mean either extension is running.

Discord controls layout and may ignore the requested activity name. The shared registered application is currently **Codex AI**, configured separately in the Discord Developer Portal; the payload requests **Claude Code** or **ChatGPT Codex**. Renaming this repository does not change that external setting.

## Companions

Clawd is a community pixel-art rendition of Anthropic's orange character, with nine transparent animation loops.

| Thinking                                                              | Working                                                               | Waiting                                                               | Finished                                                              |
| --------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| <img src="artwork/claude/clawd/review.gif" width="96" alt="Thinking"> | <img src="artwork/claude/clawd/running.gif" width="96" alt="Working"> | <img src="artwork/claude/clawd/waiting.gif" width="96" alt="Waiting"> | <img src="artwork/claude/clawd/waving.gif" width="96" alt="Finished"> |

Codex retains the original application frames and native timing. Supported Codex pets: `codex`, `dewey`, `fireball`, `hoots`, `rocky`, `seedy`, `stacky`, `bsod`, `null-signal`. The active supported pet is used; if disabled or unsupported, the last supported pet or default Codex companion is used. Custom pets are never uploaded. Only Codex cards show the ChatGPT badge.

```sh
npx --yes github:xD-Mohamed/agent-presence install --pet null-signal
```

`--pet` overrides only Codex; Claude always uses Clawd. `--artwork-base URL` accepts a public HTTPS directory containing `<codex-pet>/<animation>.gif` and `clawd/<animation>.gif`. `--no-image` hides all artwork.

## Commands

Use the `npx --yes github:xD-Mohamed/agent-presence` prefix:

| Add this           | Result                                              |
| ------------------ | --------------------------------------------------- |
| `install`          | Install/update background runtime and login startup |
| `start`            | Start an installed runtime                          |
| `stop`             | Stop and clear presence; keep login startup         |
| `uninstall`        | Remove managed startup/runtime; keep remembered pet |
| `--dry-run --once` | Preview only the public payload without Discord     |
| `--help`           | Show options                                        |

Options: `--hide-project`, `--hide-model`, `--hide-diff`, `--no-image`, `--pet NAME`, `--codex-home PATH`, `--claude-home PATH`, `--artwork-base URL`.

```sh
npx --yes github:xD-Mohamed/agent-presence install --hide-project --hide-diff
```

Reinstalling without flags preserves saved options. Explicit homes and `CODEX_HOME` / `CLAUDE_CONFIG_DIR` are saved as absolute paths for login startup. Neither assistant's settings, sessions or projects are modified.

## Compatibility

| Assistant / surface | Activity source                                                               |
| ------------------- | ----------------------------------------------------------------------------- |
| Codex Desktop       | Read-only SQLite history, JSONL fallback                                      |
| Codex CLI / VS Code | Local Codex session records                                                   |
| Claude Code Desktop | Parent JSONL records marked `claude-desktop`                                  |
| Claude Code CLI     | Parent JSONL records marked `cli`, including older records without entrypoint |
| Claude Code VS Code | Parent JSONL records marked `claude-vscode` or `vscode`                       |

Codex uses `~/.codex`, `CODEX_HOME` or `--codex-home`. Claude uses `~/.claude/projects/*/*.jsonl`, `CLAUDE_CONFIG_DIR` or `--claude-home`. See [Claude's data-directory documentation](https://code.claude.com/docs/en/claude-directory). Subagents, SDK sessions and unknown Claude entrypoints are excluded. Internal schemas can change; unsupported records are omitted. Disabled transcript persistence prevents task detection.

Older npm-based Claude runs under Node: fresh transcript activity works, but a generic Node process cannot confirm persistent CLI Idle or immediate closure. Native CLI installations support process-based liveness. Remote/SSH, cloud and WSL-hosted sessions require data and processes accessible in the same environment as Discord; automatic remote bridging is not implemented.

Windows uses a least-privilege per-user Task Scheduler logon task and a windowless .NET launcher compiled from the bundled C# source. It starts Node with `CreateNoWindow`, drains output and does not open a console. No password, VBS, PowerShell startup wrapper or elevated task is used. macOS uses a LaunchAgent; Linux uses XDG autostart. Node must remain at its recorded path; reinstall after moving it.

For upgrade compatibility, **Agent Presence keeps the existing installer directories, identifiers, task names and local control protocol**. Windows files remain in `%LOCALAPPDATA%\Programs\Codex Discord RPC`; the task is `CodexDiscordRPC-<installation-id>`. macOS/Linux retain their `codex-discord-rpc` locations. This updates one existing publisher and keeps preferences. Legacy Windows options/pet are imported only when no current record exists; unrelated files and old runtime files remain untouched. Uninstall removes only recorded managed files and the managed startup entry.

## Privacy

Only assistant identity, a fixed status label, optional model/effort, project basename, numeric tracked Git totals, timestamp and public artwork URLs are sent to Discord.

**Never sent:** prompts, reasoning text, responses, filenames, file contents, full paths, session/account IDs, usage/quota, credentials or tokens.

JSONL bodies can pass through the local parser and bounded partial-line buffer, but are not logged or included in public payloads. Tool commands are classified, never executed. Git disables external diffs/text conversion. Runtime has no HTTP client, telemetry or API requests; it talks to local Discord IPC. Discord fetches public immutable artwork URLs. The reader never opens `auth.json` or `.credentials.json`.

## Troubleshooting

- **No activity:** open Discord desktop and the assistant/backend, then run `--dry-run --once`. Unsupported process layouts or internal session schemas may prevent detection.
- **Idle after work:** expected while a supported native surface stays open. New work replaces Idle automatically.
- **Duplicate instance:** use `stop`, then `start`. One publisher serves both assistants.
- **Startup:** check the `CodexDiscordRPC-…` task on Windows. Managed devices may block login-task creation. Try foreground mode for a diagnostic.
- **npm `EPERM` / `TAR_ENTRY_ERROR`:** check antivirus notifications; if none match, try an isolated npm cache. Do not disable protection or add exclusions to force installation.
- **Antivirus notice:** keep protection enabled and retain the detection name, path and file hash. No antivirus approval or binary-signing claim is made; see [SECURITY.md](SECURITY.md).

## Development

```sh
npm ci
npm test
npm run check
node scripts/build-artwork.js /path/to/v2-sprites artwork/natural
node scripts/build-clawd.js
npm pack --dry-run
```

The Windows startup integration test requires an isolated machine with no running publisher. On an active workstation run unit tests separately and leave that test to CI. GitHub CI covers Linux/Windows on Node 22.18 and 24, plus installation/update/removal directly from GitHub. Full interactive reboot and real macOS/Linux login startup are not covered.

See [AGENTS.md](AGENTS.md) for architecture and [THIRD_PARTY.md](THIRD_PARTY.md) for attribution. Source code is MIT; OpenAI/Anthropic characters and trademarks are not relicensed. This is an unofficial community integration, not an OpenAI, Anthropic or Discord product.
