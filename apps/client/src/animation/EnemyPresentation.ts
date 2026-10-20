import type { Enemy } from "../../../../packages/shared/src/gameTypes.js";
export function enemyDirection(angle: number, directions = 4) {
  if (directions === 8)
    return [
      "east",
      "south-east",
      "south",
      "south-west",
      "west",
      "north-west",
      "north",
      "north-east",
    ][((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8];
  return Math.abs(Math.cos(angle)) >= Math.abs(Math.sin(angle))
    ? Math.cos(angle) >= 0
      ? "east"
      : "west"
    : Math.sin(angle) >= 0
      ? "south"
      : "north";
}
/** Follow current motion, including forced displacement, without changing attack aim. */
export class EnemyPresentation {
  private previous: {
    x: number;
    y: number;
    tick: number;
    state: Enemy["state"];
    attackSeq: number;
  } | null = null;
  private displaced = false;
  private displacementFacing = 0;
  private interrupted: number | null = null;
  update(e: Readonly<Enemy>, tick: number) {
    const speed = Math.hypot(e.vx, e.vy),
      moving = speed > 0.1;
    if (!this.previous || tick !== this.previous.tick) {
      const dx = this.previous ? e.x - this.previous.x : 0,
        dy = this.previous ? e.y - this.previous.y : 0,
        distance = Math.hypot(dx, dy);
      const newAttack =
        e.state === "ATTACK" &&
        (this.previous?.state !== "ATTACK" ||
          this.previous.attackSeq !== e.attackSeq);
      if (newAttack) this.interrupted = null;
      this.displaced =
        !newAttack &&
        !!this.previous &&
        tick > this.previous.tick &&
        distance > 0.5 &&
        (!moving ||
          e.state === "ATTACK" ||
          (dx * e.vx + dy * e.vy) / (distance * speed) < 0.5);
      if (this.displaced) this.displacementFacing = Math.atan2(dy, dx);
      this.previous = {
        x: e.x,
        y: e.y,
        tick,
        state: e.state,
        attackSeq: e.attackSeq,
      };
    }
    const facing = this.displaced
      ? this.displacementFacing
      : moving
        ? Math.atan2(e.vy, e.vx)
        : e.facing;
    const walking = e.state !== "DEAD" && (moving || this.displaced);
    if (
      e.state === "ATTACK" &&
      (walking || enemyDirection(facing) !== enemyDirection(e.attackFacing))
    )
      this.interrupted = e.attackSeq;
    return {
      facing,
      moving: walking,
      attacking: e.state === "ATTACK" && e.attackSeq !== this.interrupted,
    };
  }
}
