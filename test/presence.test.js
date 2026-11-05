import test from "node:test";
import assert from "node:assert/strict";
import { PresenceSelection } from "../src/presence.js";

const work = (provider, id, start, project = true) => ({
  provider,
  localId: id,
  startedAt: start,
  active: true,
  state: "thinking",
  localHasProject: project,
});
test("the oldest active real project keeps the card across providers until it completes", () => {
  const select = new PresenceSelection();
  const c = work("codex", "same-id", 2),
    a = work("claude", "same-id", 3);
  assert.equal(select.select([a, c]), c);
  assert.equal(select.select([work("claude", "other", 1), c]), c);
  assert.equal(select.select([{ ...c, active: false }, a]), a);
  assert.equal(select.select([c, a]), a);
  assert.equal(select.select([]), null);
});
test("a real project preempts a projectless task and active work preempts Idle", () => {
  const select = new PresenceSelection(),
    chat = work("codex", "chat", 1, false),
    project = work("claude", "project", 2);
  assert.equal(select.select([chat]), chat);
  assert.equal(select.select([chat, project]), project);
  assert.equal(
    select.select([{ ...project, active: false, state: "idle" }, chat]),
    chat,
  );
});
