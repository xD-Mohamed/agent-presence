import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  appendFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ClaudeState, ClaudeSource } from "../src/claude.js";
import { activity } from "../src/activity.js";

const now = Date.now();
const event = (type, message = {}, extra = {}) => ({
  type,
  message,
  sessionId: "parent-session",
  cwd: "/private/Example",
  timestamp: new Date(now).toISOString(),
  isSidechain: false,
  entrypoint: "cli",
  ...extra,
});

test("Claude exposes observed effort alongside the model and respects hide-model", () => {
  const s = new ClaudeState();
  s.accept(event("user", { content: "PRIVATE_PROMPT" }));
  s.accept(
    event(
      "assistant",
      {
        model: "claude-opus-5-5",
        content: [{ type: "thinking", thinking: "PRIVATE_REASONING" }],
      },
      { effort: "xhigh" },
    ),
  );
  const snapshot = s.snapshot(now, now);
  assert.equal(snapshot.effort, "xhigh");
  assert.equal(
    activity(snapshot).details,
    "Thinking · Claude Opus 5.5 · Xhigh",
  );
  assert.equal(s.snapshot(now, now, false, true).effort, null);
  assert.doesNotMatch(
    JSON.stringify(activity(s.snapshot(now, now, false, true))),
    /Opus|Xhigh|PRIVATE/,
  );
  s.accept(
    event(
      "assistant",
      {
        model: "claude-opus-5-5",
        content: [{ type: "text", text: "PRIVATE" }],
      },
      { effort: "high" },
    ),
  );
  assert.equal(s.snapshot(now, now).effort, "high");
});

test("Claude effort never comes from text, never accepts unknown values, and resets for a new prompt or model", () => {
  const s = new ClaudeState();
  const message = {
    model: "claude-opus-5-5",
    content: [{ type: "text", text: "effort: high" }],
  };
  s.accept(event("assistant", message));
  assert.equal(s.snapshot(now, now).effort, undefined);
  s.accept(event("assistant", message, { effort: "high" }));
  s.accept(
    event("user", {
      content: [
        { type: "tool_result", tool_use_id: "tool", content: "private" },
      ],
    }),
  );
  assert.equal(s.snapshot(now, now).effort, "high");
  s.accept(event("user", { content: "new prompt" }));
  assert.equal(s.snapshot(now, now).effort, undefined);
  s.accept(event("assistant", message, { effort: "max" }));
  s.accept(event("assistant", { ...message, model: "claude-sonnet-5-5" }));
  assert.equal(s.snapshot(now, now).effort, undefined);
  for (const effort of [
    "PRIVATE_EFFORT",
    "auto",
    "unset",
    123,
    { secret: "PRIVATE" },
  ]) {
    s.accept(event("assistant", message, { effort }));
    assert.equal(s.snapshot(now, now).effort, undefined);
    assert.doesNotMatch(JSON.stringify(s), /PRIVATE/);
  }
});

test("interrupted Claude turns release the card and compaction summaries do not start new turns", () => {
  for (const text of [
    "[Request interrupted by user]",
    "[Request interrupted by user for tool use]",
  ]) {
    const s = new ClaudeState();
    s.accept(event("user", { content: "hello" }));
    const started = s.startedAt;
    s.accept(
      event(
        "user",
        { content: [{ type: "text", text: "PRIVATE_SUMMARY" }] },
        {
          isCompactSummary: true,
          timestamp: new Date(now + 500).toISOString(),
        },
      ),
    );
    assert.equal(s.startedAt, started);
    s.accept(
      event(
        "user",
        { content: [{ type: "text", text }] },
        { timestamp: new Date(now + 1000).toISOString() },
      ),
    );
    assert.equal(s.snapshot(now + 1000, now + 1000).active, false);
    assert.equal(s.snapshot(now + 1000, now + 1000).state, "done");
    assert.equal(s.startedAt, started);
  }
});
test("Claude lifecycle classifies tools without retaining content and finishes on end_turn", () => {
  const s = new ClaudeState();
  s.accept(event("user", { content: "PRIVATE_PROMPT" }));
  assert.equal(s.snapshot(now, now).state, "thinking");
  s.accept(
    event("assistant", {
      model: "claude-opus-4-6",
      content: [
        {
          type: "tool_use",
          id: "call",
          name: "Edit",
          input: { file_path: "SECRET_FILE", new_string: "SECRET_CONTENT" },
        },
      ],
      stop_reason: "tool_use",
    }),
  );
  assert.equal(s.snapshot(now, now).state, "editing");
  s.accept(
    event("user", {
      content: [
        { type: "tool_result", tool_use_id: "call", content: "SECRET_OUTPUT" },
      ],
    }),
  );
  assert.equal(s.snapshot(now, now).state, "thinking");
  s.accept(
    event("assistant", {
      model: "claude-opus-4-6",
      content: [{ type: "text", text: "SECRET_REPLY" }],
      stop_reason: "end_turn",
    }),
  );
  const snapshot = s.snapshot(now, now);
  assert.equal(snapshot.active, false);
  assert.equal(snapshot.provider, "claude");
  assert.equal(snapshot.project, "Example");
  assert.doesNotMatch(JSON.stringify(s), /PRIVATE_PROMPT|SECRET/);
  assert.doesNotMatch(
    JSON.stringify(activity(snapshot)),
    /private|parent-session|SECRET/,
  );
  assert.equal(s.snapshot(now + 61_000, now + 61_000), null);
});
test("Claude preserves turn start across tools, ignores synthetic users, and detects Desktop", () => {
  const s = new ClaudeState();
  s.accept(
    event("user", { content: "prompt" }, { entrypoint: "claude-desktop" }),
  );
  const start = s.startedAt;
  s.accept(
    event(
      "assistant",
      {
        content: [
          { type: "tool_use", name: "Bash", input: { command: "npm test" } },
        ],
        stop_reason: "tool_use",
      },
      {
        timestamp: new Date(now + 2000).toISOString(),
        entrypoint: "claude-desktop",
      },
    ),
  );
  assert.equal(s.snapshot(now + 2000, now + 2000).state, "testing");
  s.accept(event("user", { content: "metadata" }, { isMeta: true }));
  assert.equal(s.startedAt, start);
  assert.equal(s.surface, "Desktop");
  s.accept(event("system", {}, { subtype: "turn_duration" }));
  assert.equal(s.active, false);
});
test("sidechains, SDKs, unknown schemas and stale work fail closed", () => {
  for (const extra of [
    { isSidechain: true },
    { entrypoint: "sdk-py" },
    { entrypoint: "unknown-future" },
  ]) {
    const s = new ClaudeState();
    s.accept(event("user", { content: "secret" }, extra));
    assert.equal(s.snapshot(now, now), null);
  }
  const s = new ClaudeState();
  s.accept(event("unknown", { content: "secret" }));
  assert.equal(s.snapshot(now, now), null);
  s.accept(event("user", { content: "hello" }));
  assert.equal(s.snapshot(now + 601_000, now), null);
  assert.equal(s.snapshot(now, now, true, true).project, null);
});
test("Claude source discovers only parent transcripts, handles partial lines, and filters closed surfaces", (t) => {
  const home = mkdtempSync(join(tmpdir(), "agent-presence-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const dir = join(home, "projects", "encoded-project");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "parent-session.jsonl");
  const first = JSON.stringify(event("user", { content: "PRIVATE" })) + "\n";
  const next = JSON.stringify(
    event("assistant", {
      content: [
        { type: "tool_use", name: "Read", input: { file_path: "PRIVATE" } },
      ],
      stop_reason: "tool_use",
    }),
  );
  writeFileSync(file, first + next.slice(0, 40));
  writeFileSync(join(dir, "agent-child.jsonl"), first);
  const source = new ClaudeSource(home);
  assert.equal(source.snapshot(now, ["CLI"]).state, "thinking");
  appendFileSync(file, next.slice(40) + "\n");
  assert.equal(source.snapshot(now + 1000, ["CLI"]).state, "reading");
  assert.equal(source.snapshot(now + 1000, []), null);
  writeFileSync(
    file,
    JSON.stringify(event("user", { content: "restart" })) + "\n",
  );
  assert.equal(source.snapshot(now + 2000, ["CLI"]).state, "thinking");
  assert.equal(source.files.length, 1);
});

test("large transcripts preserve model metadata and a later tail event without old activity", (t) => {
  const home = mkdtempSync(join(tmpdir(), "agent-presence-large-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const dir = join(home, "projects", "project");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "parent.jsonl");
  const head = event("assistant", {
    model: "claude-sonnet-4-6",
    content: [{ type: "text", text: "SECRET" }],
    stop_reason: "end_turn",
  });
  const middle = JSON.stringify({
    type: "unknown",
    payload: "SECRET".repeat(500_000),
  });
  const tail = event("user", { content: "PRIVATE" });
  writeFileSync(
    file,
    [head].map(JSON.stringify).join("\n") +
      "\n" +
      middle +
      "\n" +
      JSON.stringify(tail) +
      "\n",
  );
  const source = new ClaudeSource(home, { hideModel: true, hideProject: true });
  const s = source.snapshot(now, ["CLI?"]);
  assert.equal(s.state, "thinking");
  assert.equal(s.model, null);
  assert.equal(s.project, null);
  assert.doesNotMatch(JSON.stringify(activity(s)), /SECRET|PRIVATE|private/);
});

test("Claude failures, approvals and VS Code have fixed public states", () => {
  for (const [name, want] of [
    ["AskUserQuestion", "waiting"],
    ["ExitPlanMode", "waiting"],
    ["EnterPlanMode", "planning"],
    ["WebSearch", "searching"],
  ]) {
    const s = new ClaudeState();
    s.accept(
      event(
        "assistant",
        {
          content: [{ type: "tool_use", name, input: { secret: "SECRET" } }],
          stop_reason: "tool_use",
        },
        { entrypoint: "claude-vscode" },
      ),
    );
    assert.equal(s.snapshot(now, now).state, want);
    assert.equal(s.surface, "VS Code");
  }
  const s = new ClaudeState();
  s.accept(
    event(
      "assistant",
      {
        model: "<synthetic>",
        content: [{ type: "text", text: "PRIVATE_ERROR" }],
      },
      { isApiErrorMessage: true },
    ),
  );
  assert.equal(s.snapshot(now, now).state, "failed");
  assert.doesNotMatch(JSON.stringify(s), /PRIVATE_ERROR/);
});

test("large transcript gaps do not reuse an old turn's effort", (t) => {
  const home = mkdtempSync(join(tmpdir(), "agent-presence-effort-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const dir = join(home, "projects", "project");
  mkdirSync(dir, { recursive: true });
  const first = event(
    "assistant",
    {
      model: "claude-opus-5-5",
      content: [{ type: "text", text: "old" }],
      stop_reason: "end_turn",
    },
    { effort: "high" },
  );
  const middle = JSON.stringify({
    type: "unknown",
    content: "x".repeat(3 * 1024 * 1024),
  });
  const last = event("assistant", {
    model: "claude-opus-5-5",
    content: [{ type: "thinking", thinking: "private" }],
  });
  for (const prefix of [
    [],
    [event("system", {}, { subtype: "compact_boundary" })],
  ]) {
    writeFileSync(
      join(dir, "parent.jsonl"),
      JSON.stringify(first) +
        "\n" +
        middle +
        "\n" +
        [...prefix, last].map(JSON.stringify).join("\n") +
        "\n",
    );
    const snapshot = new ClaudeSource(home).snapshot(now, ["CLI"]);
    assert.equal(snapshot.state, "thinking");
    assert.equal(snapshot.effort, undefined);
  }
});
