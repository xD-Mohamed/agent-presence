# Agent Presence

Extend the existing local Discord publisher to Codex and Claude Code, including
local Desktop, CLI and VS Code sessions. The user confirmed the orange Clawd
character for Claude. Keep Codex pets and all existing privacy switches.

## Approach

Read local transcripts, without installing hooks or modifying either assistant.
Hooks would provide more immediate lifecycle events but require changing user
configuration; process-only detection cannot report task activity. Retain the
existing bounded JSONL reader and add a Claude state reducer. Ignore subagents,
SDK sessions and unsupported records. Read only metadata into retained state.
Unknown schemas fail closed. Local formats can drift; remote bridging is out of scope.

Select the oldest active real project across providers and keep it until done.
Maintain idle history separately per provider. Use executable paths only for
liveness; generic Node cannot confirm which JavaScript CLI is open. Fresh
transcripts may be shown in that case, but do not invent persistent Idle.

Rename the product, package and repository to Agent Presence / agent-presence.
Keep the old executable alias, installer identity, directories, task names and
loopback protocol so updates replace an existing publisher and retain preferences.
The Discord application's registered name is external configuration; the payload
requests the appropriate assistant name. Keep the existing application ID.

Create transparent, code-drawn Clawd pixel animations, attributed as a community
rendition of Anthropic's character. Pin public artwork URLs to a published commit.

Verify synthetic Claude lifecycles, fragmented/large transcripts, privacy,
cross-provider selection, process classification, persisted custom homes, existing
tests, package contents and a read-only local public-payload preview.
