import test from "node:test";
import assert from "node:assert/strict";
import { companionImage } from "../src/companion.js";
import { CLAWD_ANIMATIONS } from "../src/clawd.js";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

test("Clawd follows Claude independently of the Codex pet and custom artwork honors both", () => {
  assert.match(
    companionImage({ provider: "claude", state: "thinking" }, "dewey"),
    /\/clawd\/thinking.gif$/,
  );
  assert.match(
    companionImage({ provider: "codex", state: "editing" }, "dewey"),
    /\/dewey\/running.gif$/,
  );
  assert.equal(
    companionImage({ provider: "claude", state: "waiting" }, "codex", {
      artworkBase: "https://example.com/assets/",
    }),
    "https://example.com/assets/clawd/waiting.gif",
  );
  assert.equal(
    companionImage({ provider: "claude" }, "codex", { noImage: true }),
    undefined,
  );
  assert.equal(companionImage(null, "codex"), undefined);
});

test("every selectable native clip exists and matches the verified animation manifest", () => {
  const root = new URL("../artwork/claude-native/clawd/", import.meta.url);
  const manifest = JSON.parse(
    readFileSync(new URL("manifest.json", root), "utf8"),
  );
  for (const clip of new Set(Object.values(CLAWD_ANIMATIONS).flat())) {
    const bytes = readFileSync(new URL(`${clip}.gif`, root));
    assert.match(bytes.subarray(0, 6).toString(), /^GIF8[79]a$/);
    assert.ok(manifest.clips[clip].frames > 1);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      manifest.clips[clip].sha256,
    );
  }
});

test("Claude varies complete appropriate clips slowly while keeping Codex and custom packs stable", () => {
  const s = { provider: "claude", state: "editing", startedAt: 100 };
  const at = (seconds) => companionImage(s, "dewey", { now: seconds * 1000 });
  assert.match(at(100), /\/laptop.gif$/);
  assert.equal(at(129), at(100));
  assert.match(at(130), /\/desktop.gif$/);
  assert.equal(at(160), at(100));
  assert.equal(
    companionImage({ ...s, provider: "codex" }, "dewey", { now: 100000 }),
    companionImage({ ...s, provider: "codex" }, "dewey", { now: 140000 }),
  );
  assert.match(
    companionImage({ ...s, state: "unknown" }, "dewey", { now: 100000 }),
    /\/swaying.gif$/,
  );
});
