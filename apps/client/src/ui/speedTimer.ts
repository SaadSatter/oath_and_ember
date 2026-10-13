// A full clockwise shade during the boost, then counterclockwise clearing.
// Timers come from authoritative snapshots; this never activates an ability.
export function speedTimer(
  activeSeconds = 0,
  cooldownSeconds = 0,
  activeDuration = 10,
  rechargeDuration = 5,
) {
  const active = Math.max(0, activeSeconds);
  const cooldown = Math.max(0, cooldownSeconds);
  const phase = active > 0 ? "active" : cooldown > 0 ? "cooldown" : "ready";
  const fraction =
    phase === "active"
      ? 1 - Math.min(1, active / activeDuration)
      : phase === "cooldown"
        ? Math.min(1, cooldown / rechargeDuration)
        : 0;
  return { phase, angle: fraction * 360, seconds: active || cooldown };
}
