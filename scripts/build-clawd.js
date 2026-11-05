// Community pixel-art rendition of Anthropic's Clawd, drawn as SVG geometry.
// No image model, downloaded sprites or runtime dependencies are involved.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const target = process.argv[2] || "artwork/claude/clawd";
await mkdir(target, { recursive: true });
const names = [
  "idle",
  "review",
  "running",
  "waiting",
  "failed",
  "waving",
  "jumping",
  "running-right",
  "running-left",
];
function frame(state, i) {
  const phase = (i / 8) * Math.PI * 2;
  const run = state.startsWith("running");
  const jump =
    state === "jumping" ? -Math.round(Math.abs(Math.sin(phase)) * 5) : 0;
  const bob = run ? (i % 2 ? -1 : 0) : i >= 4 ? -1 : 0;
  const x =
    state === "running-right"
      ? Math.round(Math.sin(phase) * 2)
      : state === "running-left"
        ? -Math.round(Math.sin(phase) * 2)
        : 0;
  const blink = (state === "idle" || state === "waiting") && i === 6;
  const eyes =
    state === "failed"
      ? '<path d="m11 12 3 3m0-3-3 3m7-3 3 3m0-3-3 3" stroke="#251e1b" stroke-width="1"/>'
      : `<rect x="11" y="${state === "review" ? 12 : 13}" width="2" height="${blink ? 1 : 3}"/><rect x="19" y="${state === "review" ? 12 : 13}" width="2" height="${blink ? 1 : 3}"/>`;
  const wave = state === "waving" && i % 4 < 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 32 32" shape-rendering="crispEdges">
    <g transform="translate(${x} ${jump + bob})">
      <g fill="#d97757">
        <path d="M8 8h16v2h3v9h-3v3H8v-3H5v-9h3z"/>
        <rect x="3" y="12" width="3" height="6"/><rect x="26" y="${wave ? 6 : 12}" width="3" height="${wave ? 9 : 6}"/>
        <rect x="8" y="21" width="3" height="${run && i % 2 ? 3 : 5}"/><rect x="13" y="21" width="2" height="${run && i % 2 ? 5 : 3}"/>
        <rect x="18" y="21" width="2" height="${run && i % 2 ? 3 : 5}"/><rect x="22" y="21" width="3" height="${run && i % 2 ? 5 : 3}"/>
      </g>
      <g fill="#251e1b">${eyes}</g>
      ${state === "review" ? '<rect x="23" y="19" width="4" height="2" fill="#edb29b"/>' : ""}
      ${state === "waiting" && i < 4 ? '<path d="M28 2h1v3h-1zm0 4h1v1h-1z" fill="#d97757"/>' : ""}
    </g></svg>`;
}
for (const name of names) {
  const frames = [];
  for (let i = 0; i < 8; i++)
    frames.push(
      await sharp(Buffer.from(frame(name, i)))
        .ensureAlpha()
        .raw()
        .toBuffer(),
    );
  const file = join(target, `${name}.gif`);
  await sharp(Buffer.concat(frames), {
    raw: { width: 256, height: 256 * 8, channels: 4, pageHeight: 256 },
  })
    .gif({
      loop: 0,
      delay: Array(8).fill(name === "idle" ? 180 : 120),
      effort: 7,
      keepDuplicateFrames: true,
    })
    .toFile(file);
  const meta = await sharp(file, { animated: true }).metadata();
  if (meta.pages !== 8 || meta.pageHeight !== 256 || !meta.hasAlpha)
    throw new Error(`Invalid Clawd animation: ${name}`);
}
await writeFile(join(target, "clawd.svg"), frame("idle", 0));
await sharp(Buffer.from(frame("idle", 0)))
  .png()
  .toFile(join(target, "preview.png"));
console.log(`Built ${names.length} verified transparent Clawd animations.`);
