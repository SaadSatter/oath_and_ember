import {
  griffinGroomDurations,
  griffinNest,
  type GriffinState,
} from "../../../../packages/shared/src/griffin.js";

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
export function griffinProps(g: GriffinState, ahead = 0) {
  const stage = g.phase === "GROOMING" ? g.groomingStage : undefined;
  const elapsed =
    (stage && stage !== "RETURN" && stage !== "DONE"
      ? griffinGroomDurations[stage] - g.timer
      : 0) + ahead;
  const pose = (x: number, y: number, visible: boolean, rotation = 0) => ({
    x,
    y,
    visible,
    rotation,
  });
  const mirror = pose(
    griffinNest.x - 24,
    griffinNest.y,
    g.mirrorDelivered && !g.toolsTaken,
  );
  const shears = pose(
    griffinNest.x + 24,
    griffinNest.y,
    !!g.shearsDelivered && !g.toolsTaken,
  );
  const wig = pose(
    griffinNest.x,
    griffinNest.y,
    !!g.wigDropped && !g.wigClaimed,
  );
  if (stage && ["STAND", "SOUTH", "NORTH", "CUT"].includes(stage)) {
    const lift = stage === "STAND" ? smooth(elapsed / 0.7) : 1;
    const handX = g.x + (stage === "NORTH" ? 34 : -34);
    mirror.x += (handX - mirror.x) * lift;
    mirror.y += (g.y - 62 - mirror.y) * lift;
    mirror.rotation = -0.3 * lift + Math.sin(elapsed * 4) * 0.06 * lift;
    mirror.visible = g.mirrorDelivered;
    if (stage === "CUT") {
      const lift = smooth(elapsed / 0.25);
      shears.x += (g.x + 30 - shears.x) * lift;
      shears.y += (g.y - 68 - shears.y) * lift;
      shears.rotation = lift * (0.4 + Math.sin(elapsed * 26) * 0.2);
      shears.visible = !!g.shearsDelivered;
    }
  }
  if (stage === "DEPART" && !g.wigClaimed) {
    const fall = clamp(elapsed / 0.9);
    wig.visible = true;
    wig.x = griffinNest.x + 18 * Math.sin(Math.PI * fall);
    wig.y = griffinNest.y - 84 + 84 * fall * fall;
    wig.rotation = fall < 1 ? Math.sin(Math.PI * fall) * 0.5 : 0;
  }
  return { mirror, shears, wig };
}
