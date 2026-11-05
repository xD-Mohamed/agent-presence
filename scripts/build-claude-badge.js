import sharp from "sharp";

const source = "artwork/branding/claude-mark-transparent.svg";
const output = "artwork/branding/claude-mark-transparent.png";
await sharp(source).resize(256, 256).png().toFile(output);
const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const alpha = (x, y) => data[(y * info.width + x) * 4 + 3];
for (let n = 0; n < 256; n++) {
  if (alpha(n, 0) || alpha(n, 255) || alpha(0, n) || alpha(255, n)) throw new Error("Claude badge must have transparent padding");
}
if (!alpha(128, 128)) throw new Error("Claude badge is empty");
console.log("Claude badge: 256 x 256, transparent background and padding verified.");
