// Decode upstream JSON pixel deltas as data; never evaluate the source TS.
export function decodeSprite(sprite) {
  const { w, h, fps, palette, a0, base, deltas } = sprite;
  if (
    !Number.isInteger(w) ||
    !Number.isInteger(h) ||
    w < 1 ||
    h < 1 ||
    w > 256 ||
    h > 256 ||
    !Number.isFinite(fps) ||
    fps < 1 ||
    fps > 50 ||
    !Array.isArray(palette) ||
    !palette.length ||
    palette.length > 36 ||
    palette.some((c) => !/^#[0-9a-f]{6}$/i.test(c)) ||
    typeof base !== "string" ||
    base.length !== w * h ||
    !Array.isArray(deltas) ||
    !Array.isArray(a0) ||
    a0.length !== 4 ||
    a0.some((n) => !Number.isInteger(n))
  )
    throw new Error("Invalid sprite metadata");
  const color = (c) => {
    if (c === ".") return 255;
    if (!/^[0-9a-z]$/.test(c) || parseInt(c, 36) >= palette.length)
      throw new Error("Invalid sprite palette index");
    return parseInt(c, 36);
  };
  const pixels = Uint8Array.from(base, color);
  const frames = [pixels.slice()];
  for (const delta of deltas) {
    if (typeof delta !== "string") throw new Error("Invalid sprite delta");
    if (delta)
      for (const token of delta.split(",")) {
        if (!/^[0-9a-z]+[.0-9a-z]$/.test(token))
          throw new Error("Invalid sprite delta");
        const index = parseInt(token.slice(0, -1), 36);
        if (index >= pixels.length)
          throw new Error("Sprite delta is outside the canvas");
        pixels[index] = color(token.at(-1));
      }
    frames.push(pixels.slice());
  }
  const anchor = a0[2] > 0 ? a0 : [0, 0, w, h];
  return {
    frames,
    offset: {
      x: -Math.round(anchor[0] + anchor[2] / 2),
      y: -(anchor[1] + anchor[3]),
    },
  };
}

export function frameDelays(count, fps) {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    !Number.isFinite(fps) ||
    fps < 1 ||
    fps > 50
  )
    throw new Error("Invalid animation timing");
  return Array.from(
    { length: count },
    (_, i) =>
      (Math.round(((i + 1) * 100) / fps) - Math.round((i * 100) / fps)) * 10,
  );
}
