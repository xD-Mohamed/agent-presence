import { ARTWORK_BASE, CLAWD_ARTWORK_BASE } from "./config.js";
import { ANIMATIONS } from "./activity.js";
import { clawdAnimation } from "./clawd.js";

export function companionImage(
  snapshot,
  codexPet,
  { noImage = false, artworkBase, now = Date.now() } = {},
) {
  if (!snapshot || noImage) return undefined;
  const claude = snapshot.provider === "claude";
  const pet = claude ? "clawd" : codexPet;
  if (!pet) return undefined;
  const base = artworkBase || (claude ? CLAWD_ARTWORK_BASE : ARTWORK_BASE);
  // Custom directories retain the existing nine-animation contract.
  const animation =
    claude && !artworkBase
      ? clawdAnimation(snapshot, now)
      : ANIMATIONS[snapshot.state] || "idle";
  return `${base.replace(/\/$/, "")}/${pet}/${animation}.gif`;
}
