import type { Role } from "./gameTypes.js";
export const siegPalettes = [
  "crimson",
  "blue",
  "green",
  "charcoal",
  "ivory",
] as const;
export const cocoPalettes = [
  "purple",
  "blue",
  "crimson",
  "emerald",
  "charcoal",
] as const;
export const magicPalettes = [
  "ember",
  "arcane",
  "violet",
  "emerald",
  "rose",
] as const;
export type CharacterAppearance =
  | { primaryPalette: (typeof siegPalettes)[number]; effectPalette?: never }
  | {
      primaryPalette: (typeof cocoPalettes)[number];
      effectPalette: (typeof magicPalettes)[number];
    };
export const defaultAppearance = (role: Role): CharacterAppearance =>
  role === "OATH"
    ? { primaryPalette: "crimson" }
    : { primaryPalette: "purple", effectPalette: "ember" };
export function validAppearance(
  role: Role,
  value: unknown,
): value is CharacterAppearance {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const a = value as Record<string, unknown>;
  if (
    Object.keys(a).some((k) => !["primaryPalette", "effectPalette"].includes(k))
  )
    return false;
  return role === "OATH"
    ? siegPalettes.some((p) => p === a.primaryPalette) &&
        !("effectPalette" in a)
    : cocoPalettes.some((p) => p === a.primaryPalette) &&
        magicPalettes.some((p) => p === a.effectPalette);
}
