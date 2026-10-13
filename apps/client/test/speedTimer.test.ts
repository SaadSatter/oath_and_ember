import { expect, it } from "vitest";
import { speedTimer } from "../src/ui/speedTimer.js";
it("darkens clockwise through the boost and clears counterclockwise through recharge", () => {
  expect(speedTimer(10, 15)).toMatchObject({ phase: "active", angle: 0 });
  expect(speedTimer(5, 10)).toMatchObject({ phase: "active", angle: 180 });
  expect(speedTimer(0, 5)).toMatchObject({ phase: "cooldown", angle: 360 });
  expect(speedTimer(0, 2.5)).toMatchObject({ phase: "cooldown", angle: 180 });
  expect(speedTimer(0, 0)).toMatchObject({ phase: "ready", angle: 0 });
});
it("uses the same radial shade for ten-second Slow Time and ten-second recharge", () => {
  expect(speedTimer(10, 20, 10, 10)).toMatchObject({
    angle: 0,
    phase: "active",
  });
  expect(speedTimer(5, 15, 10, 10)).toMatchObject({
    angle: 180,
    phase: "active",
  });
  expect(speedTimer(0, 10, 10, 10)).toMatchObject({
    angle: 360,
    phase: "cooldown",
  });
  expect(speedTimer(0, 5, 10, 10)).toMatchObject({
    angle: 180,
    phase: "cooldown",
  });
  expect(speedTimer(0, 0, 10, 10)).toMatchObject({ angle: 0, phase: "ready" });
});
