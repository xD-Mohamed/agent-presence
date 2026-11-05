import { ARTWORK_BASE, CLAWD_ARTWORK_BASE } from "./config.js";
import { ANIMATIONS } from "./activity.js";

export function companionImage(
  snapshot,
  codexPet,
  { noImage = false, artworkBase } = {},
) {
  if (!snapshot || noImage) return undefined;
  const claude = snapshot.provider === "claude";
  const pet = claude ? "clawd" : codexPet;
  if (!pet) return undefined;
  const base = artworkBase || (claude ? CLAWD_ARTWORK_BASE : ARTWORK_BASE);
  return `${base.replace(/\/$/, "")}/${pet}/${ANIMATIONS[snapshot.state] || "idle"}.gif`;
}
