// Fixed public clip names only. Each GIF contains a complete source sequence.
export const CLAWD_ANIMATIONS = Object.freeze({
  idle: [
    "swaying",
    "looking-around-eyes-only",
    "turning",
    "hula",
    "break-dancing",
  ],
  thinking: ["thinking"],
  planning: ["lightbulb", "pointing"],
  editing: ["laptop", "desktop"],
  testing: ["jumping", "jumping-happy"],
  reading: ["looking-around", "thinking"],
  searching: ["walking", "crab-walking", "walking-left", "crab-walking-left"],
  running: ["running", "running-left"],
  working: ["desktop", "laptop"],
  reviewing: ["thinking", "looking-around"],
  compacting: ["meditating"],
  designing: ["spark"],
  waiting: ["waving", "pointing"],
  done: ["confetti", "dancing-happy", "excited", "jumping-happy"],
  failed: ["disappointed", "facepalm", "dizzy"],
});

export function clawdAnimation(snapshot, now = Date.now()) {
  const choices = Object.hasOwn(CLAWD_ANIMATIONS, snapshot.state)
    ? CLAWD_ANIMATIONS[snapshot.state]
    : CLAWD_ANIMATIONS.idle;
  const elapsed =
    Number.isFinite(snapshot.startedAt) && Number.isFinite(now)
      ? Math.max(0, now / 1000 - snapshot.startedAt)
      : 0;
  return choices[Math.floor(elapsed / 30) % choices.length];
}
