// Full ready-made Clawd sequences. See artwork/claude-native/source/ for attribution.
import sharp from "sharp";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { decodeSprite, frameDelays } from "./lib/clawd-sprites.js";

const source = "artwork/claude-native/source";
const target = process.argv[2] || "artwork/claude-native/clawd";
const sprites = JSON.parse(
  await readFile(join(source, "sprites.json"), "utf8"),
);
const provenance = JSON.parse(
  await readFile(join(source, "provenance.json"), "utf8"),
);
if (
  createHash("sha256")
    .update(
      (await readFile(join(source, "sprites.json"), "utf8")).replaceAll(
        "\r\n",
        "\n",
      ),
    )
    .digest("hex") !== provenance.dataSha256
)
  throw new Error("Source sprite data does not match provenance");
const entries = Object.entries(sprites).map(([name, sprite]) => ({
  name,
  sprite,
  ...decodeSprite(sprite),
}));
if (
  entries.length !== provenance.animations ||
  entries.reduce((n, x) => n + x.frames.length, 0) !== provenance.sourceFrames
)
  throw new Error("Source animation/frame counts do not match provenance");
let maxWidth = 0,
  maxHeight = 0;
for (const entry of entries) {
  const { sprite, frames, offset } = entry;
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  for (const pixels of frames)
    for (let i = 0; i < pixels.length; i++)
      if (pixels[i] !== 255) {
        const x = (i % sprite.w) + offset.x,
          y = Math.floor(i / sprite.w) + offset.y;
        left = Math.min(left, x);
        right = Math.max(right, x + 1);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y + 1);
      }
  entry.bounds = { left, right, top, bottom };
  maxWidth = Math.max(maxWidth, right - left);
  maxHeight = Math.max(maxHeight, bottom - top);
}
// A single integer pixel scale for every clip, with stable framing within each.
const scale = Math.floor(Math.min(244 / maxWidth, 244 / maxHeight));
if (scale < 1) throw new Error("Sprite library cannot fit the output canvas");
const clamp = (value, low, high) => Math.max(low, Math.min(value, high));
await mkdir(target, { recursive: true });
const manifest = { ...provenance, canvas: 256, pixelScale: scale, clips: {} };
for (const { name, sprite, frames, offset, bounds } of entries) {
  const slug = name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  const colors = sprite.palette.map((hex) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)),
  );
  const variants = [{ file: slug, mirror: false }];
  if (["Walking", "Running", "CrabWalking"].includes(name))
    variants.push({ file: slug + "-left", mirror: true });
  for (const { file, mirror } of variants) {
    const left = mirror ? -bounds.right : bounds.left,
      right = mirror ? -bounds.left : bounds.right;
    const originX = clamp(128, 6 - left * scale, 250 - right * scale);
    const originY = clamp(
      200,
      6 - bounds.top * scale,
      250 - bounds.bottom * scale,
    );
    const rendered = [];
    for (const pixels of frames) {
      const rgba = Buffer.alloc(256 * 256 * 4);
      for (let i = 0; i < pixels.length; i++)
        if (pixels[i] !== 255) {
          const px = (i % sprite.w) + offset.x;
          const x = originX + (mirror ? -px - 1 : px) * scale;
          const y = originY + (Math.floor(i / sprite.w) + offset.y) * scale;
          if (x < 0 || y < 0 || x + scale > 256 || y + scale > 256)
            throw new Error(`Clipped frame in ${file}`);
          for (let dy = 0; dy < scale; dy++)
            for (let dx = 0; dx < scale; dx++) {
              const at = ((y + dy) * 256 + x + dx) * 4;
              rgba.set([...colors[pixels[i]], 255], at);
            }
        }
      rendered.push(rgba);
    }
    const delays = frameDelays(frames.length, sprite.fps);
    const output = join(target, `${file}.gif`);
    await sharp(Buffer.concat(rendered), {
      raw: {
        width: 256,
        height: 256 * frames.length,
        channels: 4,
        pageHeight: 256,
      },
    })
      .gif({ delay: delays, loop: 0, effort: 7, keepDuplicateFrames: true })
      .toFile(output);
    const result = await sharp(output, { animated: true }).metadata();
    if (
      result.pages !== frames.length ||
      result.pageHeight !== 256 ||
      result.width !== 256 ||
      !result.hasAlpha ||
      result.loop !== 0 ||
      result.delay.reduce((a, b) => a + b, 0) !==
        delays.reduce((a, b) => a + b, 0)
    )
      throw new Error(`Animation verification failed: ${file}`);
    manifest.clips[file] = {
      source: name,
      frames: frames.length,
      fps: sprite.fps,
      durationMs: delays.reduce((a, b) => a + b, 0),
      mirrored: mirror,
      sha256: createHash("sha256")
        .update(await readFile(output))
        .digest("hex"),
    };
    if (file === "swaying")
      await sharp(rendered[0], {
        raw: { width: 256, height: 256, channels: 4 },
      })
        .png()
        .toFile(join(target, "preview.png"));
  }
}
await writeFile(
  join(target, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  `Verified ${entries.length} source animations (${provenance.sourceFrames} frames), ${Object.keys(manifest.clips).length} GIFs including directional variants, no clipped pixels.`,
);
