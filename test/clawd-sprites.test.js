import test from "node:test";
import assert from "node:assert/strict";
import { decodeSprite, frameDelays } from "../scripts/lib/clawd-sprites.js";

test("sprite deltas retain unchanged pixels, clear pixels, and preserve repeated frames", () => {
  const sprite = {
    w: 2,
    h: 2,
    fps: 12,
    palette: ["#d97757", "#141413"],
    a0: [0, 0, 2, 2],
    base: "0.1.",
    deltas: ["11,2.", ""],
  };
  const { frames, offset } = decodeSprite(sprite);
  assert.deepEqual(offset, { x: -1, y: -2 });
  assert.deepEqual([...frames[0]], [0, 255, 1, 255]);
  assert.deepEqual([...frames[1]], [0, 1, 255, 255]);
  assert.deepEqual([...frames[2]], [0, 1, 255, 255]);
  assert.notEqual(frames[1], frames[2]);
});
test("invalid sprite data cannot write outside its canvas or silently drop pixels", () => {
  const sprite = {
    w: 1,
    h: 1,
    fps: 12,
    palette: ["#d97757"],
    a0: [0, 0, 1, 1],
    base: "0",
    deltas: [],
  };
  for (const bad of [
    { base: "00" },
    { base: "1" },
    { deltas: ["10"] },
    { deltas: ["bad?"] },
  ])
    assert.throws(() => decodeSprite({ ...sprite, ...bad }));
});
test("GIF centisecond rounding preserves the source duration instead of speeding up 12fps", () => {
  const delays = frameDelays(12, 12);
  assert.equal(delays.length, 12);
  assert.equal(
    delays.reduce((a, b) => a + b, 0),
    1000,
  );
  assert.ok(delays.every((x) => x === 80 || x === 90));
});
