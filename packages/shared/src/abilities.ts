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
    description: "Slash deals increased damage.",
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
