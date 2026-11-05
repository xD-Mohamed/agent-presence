import test from "node:test";
import assert from "node:assert/strict";
import { companionImage } from "../src/companion.js";

test("Clawd follows Claude independently of the Codex pet and custom artwork honors both", () => {
  assert.match(
    companionImage({ provider: "claude", state: "thinking" }, "dewey"),
    /\/clawd\/review.gif$/,
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
