import sharp from "sharp";
import { frameDelays } from "./lib/clawd-sprites.js";

const root = "artwork/claude-native/clawd";
const selections = [
  "thinking",
  "laptop",
  "walking",
  "meditating",
  "break-dancing",
  "confetti",
];
const animations = [];
for (const name of selections) {
  const meta = await sharp(`${root}/${name}.gif`, {
    animated: true,
  }).metadata();
  const pixels = await sharp(`${root}/${name}.gif`, { animated: true })
    .resize({ width: 128 })
    .ensureAlpha()
    .raw()
    .toBuffer();
  animations.push({ name, pixels, count: meta.pages });
}
const frames = [];
for (let f = 0; f < 149; f++) {
  const layers = [];
  for (let i = 0; i < animations.length; i++) {
    const a = animations[i],
      offset = (f % a.count) * 128 * 128 * 4;
    layers.push({
      input: a.pixels.subarray(offset, offset + 128 * 128 * 4),
      raw: { width: 128, height: 128, channels: 4 },
      left: (i % 3) * 160 + 16,
      top: Math.floor(i / 3) * 160,
    });
  }
  const labels = Buffer.from(
    `<svg width="480" height="320" xmlns="http://www.w3.org/2000/svg"><g fill="#e6e1dc" font-family="sans-serif" font-size="13" text-anchor="middle">${animations.map((a, i) => `<text x="${(i % 3) * 160 + 80}" y="${Math.floor(i / 3) * 160 + 147}">${a.name}</text>`).join("")}</g></svg>`,
  );
  frames.push(
    await sharp({
      create: { width: 480, height: 320, channels: 4, background: "#202123" },
    })
      .composite([...layers, { input: labels }])
      .raw()
      .toBuffer(),
  );
}
await sharp(Buffer.concat(frames), {
  raw: {
    width: 480,
    height: 320 * frames.length,
    channels: 4,
    pageHeight: 320,
  },
})
  .gif({
    delay: frameDelays(frames.length, 12),
    loop: 0,
    effort: 7,
    keepDuplicateFrames: true,
  })
  .toFile("artwork/claude-native/gallery.gif");
await sharp(frames[20], { raw: { width: 480, height: 320, channels: 4 } })
  .png()
  .toFile("artwork/claude-native/gallery.png");
console.log("Built animated six-motion Clawd gallery.");
