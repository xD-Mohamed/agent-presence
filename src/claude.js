import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { classify, projectName, toolState } from "./activity.js";
import { Tail } from "./rollouts.js";
import { PresenceSelection } from "./presence.js";
import { surfaceAvailable } from "./liveness.js";

const STALE = 10 * 60_000;
const surfaces = {
  cli: "CLI",
  "claude-desktop": "Desktop",
  "claude-vscode": "VS Code",
  vscode: "VS Code",
};
function toolActivity(block) {
  switch (block.name) {
    case "Edit":
    case "MultiEdit":
    case "Write":
    case "NotebookEdit":
      return "editing";
    case "Read":
    case "LS":
      return "reading";
    case "Grep":
    case "Glob":
    case "WebSearch":
    case "WebFetch":
      return "searching";
    case "AskUserQuestion":
    case "ExitPlanMode":
      return "waiting";
    case "EnterPlanMode":
    case "TodoWrite":
    case "TaskCreate":
    case "TaskUpdate":
      return "planning";
    case "Bash":
      return classify({
        type: "commandExecution",
        command:
          typeof block.input?.command === "string" ? block.input.command : "",
      });
    default:
      return toolState(
        typeof block.name === "string" ? block.name.toLowerCase() : "",
      );
  }
}

// Keep only classification metadata. Never retain messages, tool inputs or outputs.
export class ClaudeState {
  constructor() {
    this.active = false;
    this.state = "done";
    this.surface = "CLI";
  }
  accept(event) {
    if (!event || !["user", "assistant", "system"].includes(event.type)) return;
    if (event.isSidechain || event.parent_tool_use_id || event.agentId) {
      this.excluded = true;
      return;
    }
    if (event.isMeta || event.isCompactSummary) return;
    if (event.entrypoint) {
      if (!Object.hasOwn(surfaces, event.entrypoint)) {
        this.excluded = true;
        return;
      }
      this.surface = surfaces[event.entrypoint];
    }
    if (this.excluded) return;
    const time = Date.parse(event.timestamp);
    if (!Number.isFinite(time)) return;
    if (typeof event.sessionId === "string") this.id = event.sessionId;
    if (typeof event.cwd === "string") this.cwd = event.cwd;
    const message = event.message || {};
    const content = Array.isArray(message.content)
      ? message.content.filter((x) => x && typeof x === "object")
      : [];
    if (event.type === "user") {
      // Claude writes these exact synthetic notices when a user cancels a turn.
      const notice =
        typeof message.content === "string"
          ? message.content
          : content.length === 1 && content[0].type === "text"
            ? content[0].text
            : null;
      if (
        [
          "[Request interrupted by user]",
          "[Request interrupted by user for tool use]",
        ].includes(notice)
      ) {
        this.active = false;
        this.state = "done";
        this.completedAt = time / 1000;
        this.updatedAt = time;
        return;
      }
      const result = content.some((x) => x.type === "tool_result");
      if (!result || !this.active) this.startedAt = time / 1000;
      this.active = true;
      this.state = "thinking";
      this.completedAt = undefined;
    } else if (event.type === "assistant") {
      if (typeof message.model === "string" && message.model !== "<synthetic>")
        this.model = message.model;
      this.startedAt ??= time / 1000;
      if (event.isApiErrorMessage || message.stop_reason === "refusal") {
        this.active = false;
        this.state = "failed";
        this.completedAt = time / 1000;
      } else if (
        ["end_turn", "stop_sequence", "max_tokens"].includes(
          message.stop_reason,
        )
      ) {
        this.active = false;
        this.state = "done";
        this.completedAt = time / 1000;
      } else {
        const tool = content.findLast((x) => x.type === "tool_use");
        if (
          !tool &&
          !content.some((x) => ["thinking", "text"].includes(x.type))
        )
          return;
        this.active = true;
        this.state = tool
          ? toolActivity(tool)
          : content.some((x) => x.type === "thinking")
            ? "thinking"
            : "working";
      }
    } else if (event.subtype === "turn_duration") {
      this.active = false;
      this.state = "done";
      this.completedAt = time / 1000;
    } else if (event.subtype === "compact_boundary") {
      this.active = true;
      this.state = "compacting";
    } else return;
    this.updatedAt = time;
  }
  snapshot(now, modified, hideProject = false, hideModel = false) {
    if (
      this.excluded ||
      !this.id ||
      !this.cwd ||
      !this.updatedAt ||
      now - Math.min(modified, this.updatedAt) > STALE ||
      this.updatedAt > now + 60_000
    )
      return null;
    if (
      !this.active &&
      (!this.completedAt || now - this.completedAt * 1000 > 60_000)
    )
      return null;
    return {
      provider: "claude",
      state: this.state,
      active: this.active,
      surface: this.surface,
      model: hideModel ? null : this.model,
      project: projectName(this.cwd, hideProject),
      startedAt: this.startedAt,
      localCwd: this.cwd,
      localId: this.id,
      localHasProject: !!projectName(this.cwd),
    };
  }
}

export class ClaudeSource {
  constructor(home, options = {}) {
    this.root = join(home, "projects");
    this.options = options;
    this.cache = new Map();
    this.files = [];
    this.lastScan = -Infinity;
    this.selection = new PresenceSelection();
  }
  discover(now) {
    const files = [];
    let visited = 0;
    try {
      for (const project of readdirSync(this.root, { withFileTypes: true })) {
        if (++visited > 20_000) break;
        if (!project.isDirectory()) continue;
        try {
          for (const entry of readdirSync(join(this.root, project.name), {
            withFileTypes: true,
          })) {
            if (++visited > 20_000) break;
            // Subagents live in subdirectories or old agent-*.jsonl files.
            if (
              !entry.isFile() ||
              !entry.name.endsWith(".jsonl") ||
              entry.name.startsWith("agent-")
            )
              continue;
            const file = join(this.root, project.name, entry.name);
            const stat = statSync(file);
            if (now - stat.mtimeMs <= STALE)
              files.push({ file, time: stat.mtimeMs });
          }
        } catch {
          /* Concurrent cleanup or inaccessible project. */
        }
      }
    } catch {
      /* Claude is optional. */
    }
    this.files = files
      .sort((a, b) => b.time - a.time)
      .slice(0, 32)
      .map((x) => x.file);
    this.lastScan = now;
    for (const key of this.cache.keys())
      if (!this.files.includes(key)) this.cache.delete(key);
  }
  snapshot(now = Date.now(), openSurfaces = null) {
    if (now - this.lastScan >= 10_000) this.discover(now);
    const candidates = [];
    for (const file of this.files) {
      try {
        const stat = statSync(file);
        let tail = this.cache.get(file);
        if (!tail) {
          tail = new Tail(ClaudeState);
          this.cache.set(file, tail);
        }
        tail.read(file, stat);
        const s = tail.state.snapshot(
          now,
          stat.mtimeMs,
          this.options.hideProject,
          this.options.hideModel,
        );
        if (s && surfaceAvailable(s.surface, openSurfaces)) candidates.push(s);
      } catch {
        /* Files can rotate between discovery and reading. */
      }
    }
    return this.selection.select(candidates);
  }
  close() {
    this.cache.clear();
  }
}
