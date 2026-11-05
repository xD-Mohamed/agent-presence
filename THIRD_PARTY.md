# Third-party material

Codex and its built-in companion artwork are OpenAI material. Discord is a Discord trademark. This community integration is not affiliated with or endorsed by either company.

The GIF files under artwork are animation-format conversions of the built-in Codex companion sprite sheets. Original frames and state rows are preserved with square transparent padding. The current artwork/natural set uses native frame durations; the older artwork/slow set doubled them. They are not original project artwork and are not relicensed under this project's MIT source-code license. Source: locally installed Codex desktop 26.1007.2314.0, v2 1536x2288 atlases. Custom user pets are never uploaded by this tool.

sharp is used only by the maintainer's artwork build script; its license and third-party dependency notices are supplied by its package.

The current small ChatGPT badge uses the official openai_logo_regular vector geometry from the same locally installed desktop app, rendered in white with transparent padding and no background. Earlier app-icon variants remain for historical releases. OpenAI's Help Center identifies the ChatGPT mark: https://help.openai.com/en/articles/7905742-what-does-the-official-chatgpt-ios-app-icon-look-like . The badge identifies the OpenAI service and does not imply endorsement of this community integration.

## Claude / Clawd

Claude, Claude Code and the Clawd character identify Anthropic's product. The current `artwork/claude-native` library uses the complete sprite pixel data from [yuyongyan29-dev/claude-pet](https://github.com/yuyongyan29-dev/claude-pet), commit `92af7cea39e4331019c41341d90d486cb6f00784`, file `clawd-pet/hooks/sprites.ts`. Upstream attributes those sprites to the Claude desktop app's clawd-quest assets.

The upstream [NOTICE](artwork/claude-native/source/NOTICE) explicitly excludes the character and artwork from its MIT license. They remain Anthropic material and are **not relicensed by this project's MIT license**. This project converts the data into complete transparent GIFs, retaining the palette, every frame, and source frame rates; three horizontal mirrors add the other travel direction. It does not claim to own or license Anthropic's artwork. Repository, revision and SHA-256 hashes are recorded in [provenance.json](artwork/claude-native/source/provenance.json); frame counts, durations and GIF hashes are in [manifest.json](artwork/claude-native/clawd/manifest.json). The upstream plugin code is not installed or executed.

The old `artwork/claude/clawd` files remain a historical community pixel-art rendition from version 0.4.0, not the current native sequence library. Neither the old rendition nor Anthropic's character/trademarks is relicensed as project-owned art. This integration is not affiliated with or endorsed by Anthropic.
