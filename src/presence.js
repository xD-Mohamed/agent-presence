// Select across providers without rotating the card or colliding session IDs.
export class PresenceSelection {
  select(candidates) {
    candidates = candidates.filter(Boolean);
    const key = (s) => `${s.provider || "codex"}:${s.localId || s.surface}`;
    const active = candidates
      .filter((s) => s.active)
      .sort(
        (a, b) =>
          (a.startedAt ?? Infinity) - (b.startedAt ?? Infinity) ||
          key(a).localeCompare(key(b)),
      );
    const projects = active.filter((s) => s.localHasProject);
    const eligible = projects.length
      ? projects
      : active.length
        ? active
        : candidates;
    const selected =
      eligible.find((s) => key(s) === this.selectedId) || eligible[0] || null;
    this.selectedId = selected ? key(selected) : undefined;
    return selected;
  }
}
