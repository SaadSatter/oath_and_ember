import type { Role } from "./gameTypes.js";
export const skills = [
  {
    id: "guard",
    role: "OATH",
    name: "Guard",
    description: "Hold K to reduce incoming damage.",
  },
  {
    id: "heavy",
    role: "OATH",
    name: "Heavy Break",
    description:
      "Hold J to charge; release after 0.47s for a heavy slash. Early release slashes normally.",
  },
  {
    id: "dash",
    role: "OATH",
    name: "Dash",
    description: "K bursts forward after Guard.",
  },
  {
    id: "ward",
    role: "EMBER",
    name: "Ward",
    description: "Hold K to reduce incoming damage.",
  },
  {
    id: "telekinesis",
    role: "EMBER",
    name: "Telekinesis",
    description: "E can push the counterweight.",
  },
  {
    id: "blink",
    role: "EMBER",
    name: "Blink",
    description: "K bursts forward after Ward.",
  },
].map((s, index) => ({
  ...s,
  role: s.role as Role,
  cost: 1,
  prerequisites:
    index % 3
      ? [
          index === 1
            ? "guard"
            : index === 2
              ? "heavy"
              : index === 4
                ? "ward"
                : "telekinesis",
        ]
      : [],
}));

/** Server-selected fireball strength; level one is Coco's starting spell. */
export function fireballLevel(unlockedSkills: readonly string[]): number {
  for (let level = 4; level >= 2; level--)
    if (unlockedSkills.includes(`fireball_${level}`)) return level;
  return 1;
}
export const fireballDamage = (level: number) =>
  20 + (Math.max(1, Math.min(4, level)) - 1) * 10;
for (let level = 2; level <= 4; level++)
  skills.push({
    id: `fireball_${level}`,
    role: "EMBER",
    name: `Fireball ${level}`,
    description: `Upgrade Coco's fireball to ${fireballDamage(level)} damage.`,
    cost: 1,
    prerequisites: level === 2 ? [] : [`fireball_${level - 1}`],
  });
