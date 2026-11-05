import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

// Read executable paths only: never collect process arguments or window titles.
export function runningSurfaces(executables, provider = "codex") {
  const surfaces = new Set();
  for (const executable of executables) {
    if (typeof executable !== "string") continue;
    const normalized = executable.replaceAll("\\", "/").toLowerCase();
    const name = path.posix.basename(normalized);
    if (provider === "claude") {
      if (/\/claude\/versions\/\d+\.\d+\.\d+[^/]*$/.test(normalized)) {
        surfaces.add("CLI");
        continue;
      }
      if (!["claude", "claude.exe"].includes(name)) continue;
      if (/extensions\/anthropic\.claude-code[^/]*\//.test(normalized))
        surfaces.add("VS Code");
      else if (
        /anthropicclaude|claude\.app\/|\/windowsapps\/claude_[^/]+\/|\/claude-data\/|\/claude\/claude-code\/|\/claude\/(?:app-[^/]+\/)?claude(?:\.exe)?$/.test(
          normalized,
        )
      )
        surfaces.add("Desktop");
      else surfaces.add("CLI");
      continue;
    }
    if (!["codex", "codex.exe", "chatgpt", "chatgpt.exe"].includes(name))
      continue;
    if (/extensions\/openai\.chatgpt[^/]*\//.test(normalized))
      surfaces.add("VS Code");
    else if (
      name.startsWith("chatgpt") ||
      /openai[./]codex|codex\.app\/|chatgpt\.app\//.test(normalized)
    )
      surfaces.add("Desktop");
    else surfaces.add("CLI");
  }
  return [...surfaces];
}

export class ProcessProbe {
  constructor({
    platform = process.platform,
    run = promisify(execFile),
    provider = "codex",
  } = {}) {
    this.platform = platform;
    this.run = run;
    this.provider = provider;
    this.checkedAt = -Infinity;
    this.cached = null;
  }
  async read(now = Date.now()) {
    if (now - this.checkedAt < 5000) return this.cached;
    this.checkedAt = now;
    try {
      let paths;
      if (this.platform === "win32") {
        const { stdout } = await this.run(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            this.provider === "claude"
              ? "Get-CimInstance Win32_Process -Filter \"Name='claude.exe' OR Name='node.exe'\" | Select-Object -ExpandProperty ExecutablePath | ConvertTo-Json -Compress"
              : "Get-CimInstance Win32_Process -Filter \"Name='codex.exe' OR Name='ChatGPT.exe'\" | Select-Object -ExpandProperty ExecutablePath | ConvertTo-Json -Compress",
          ],
          {
            windowsHide: true,
            timeout: 3000,
            maxBuffer: 256 * 1024,
            encoding: "utf8",
          },
        );
        const value = stdout.trim() ? JSON.parse(stdout) : [];
        paths = Array.isArray(value) ? value : [value];
      } else {
        const { stdout } = await this.run("ps", ["-axo", "comm="], {
          timeout: 3000,
          maxBuffer: 1024 * 1024,
          encoding: "utf8",
        });
        paths = stdout.split("\n").map((x) => x.trim());
      }
      this.cached = runningSurfaces(paths, this.provider);
      // Old npm installs run as node. Arguments would expose prompts, so leave
      // CLI liveness unknown; still permit fresh transcript activity, never Idle.
      if (
        this.provider === "claude" &&
        !this.cached.includes("CLI") &&
        paths.some(
          (p) => typeof p === "string" && /(?:^|[\\/])node(?:\.exe)?$/i.test(p),
        )
      )
        this.cached.push("CLI?");
    } catch {
      this.cached = null;
    } // Unknown is not the same as confirmed closed.
    return this.cached;
  }
}

export function surfaceAvailable(surface, openSurfaces) {
  return (
    !openSurfaces ||
    openSurfaces.includes(surface) ||
    (surface === "CLI" && openSurfaces.includes("CLI?"))
  );
}

export class IdlePresence {
  constructor() {
    this.previous = new Map();
  }
  update(snapshot, openSurfaces, now = Date.now()) {
    if (Array.isArray(openSurfaces)) {
      for (const surface of this.previous.keys())
        if (!openSurfaces.includes(surface)) this.previous.delete(surface);
      if (snapshot && !surfaceAvailable(snapshot.surface, openSurfaces))
        snapshot = null;
      if (
        snapshot?.surface === "CLI" &&
        openSurfaces.includes("CLI?") &&
        !openSurfaces.includes("CLI")
      ) {
        this.idleSince = undefined;
        return snapshot;
      }
      openSurfaces = openSurfaces.filter((s) => s !== "CLI?");
      if (!openSurfaces.length) {
        this.idleSince = undefined;
        return null;
      }
    }
    if (snapshot) {
      this.previous.set(snapshot.surface, snapshot);
      this.lastSurface = snapshot.surface;
      if (snapshot.active || snapshot.state === "failed") {
        this.idleSince = undefined;
        return snapshot;
      }
    }
    if (!openSurfaces?.length) return snapshot;
    const surface = openSurfaces.includes(this.lastSurface)
      ? this.lastSurface
      : openSurfaces[0];
    const last = snapshot ||
      this.previous.get(surface) || { surface, active: false };
    this.idleSince ??= Math.floor(now / 1000);
    return { ...last, state: "idle", active: false, startedAt: this.idleSince };
  }
}
