export const palettes: Record<
  string,
  { label: string; color: string; lightMaterialGamma?: number }
> = {
  crimson: { label: "Crimson", color: "#b94050" },
  blue: { label: "Royal / Deep Blue", color: "#3e65bc" },
  green: { label: "Forest Green", color: "#397854" },
  charcoal: { label: "Charcoal", color: "#454954" },
  ivory: { label: "Ivory", color: "#f5f1e7", lightMaterialGamma: 0.6 },
  purple: { label: "Purple", color: "#76509c" },
  emerald: { label: "Emerald Green", color: "#299477" },
  ember: { label: "Ember Orange", color: "#ff9b32" },
  arcane: { label: "Arcane Blue", color: "#48afff" },
  violet: { label: "Violet", color: "#a875ff" },
  rose: { label: "Rose / Pink", color: "#ff70b7" },
};
export const effectColor = (id = "ember") =>
  Number.parseInt(palettes[id].color.slice(1), 16);
// Regions: mask red=cloth, green=magic. Source alpha and unmasked RGB are untouched.
export function recolorPixels(
  source: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  primary: string,
  effect: string | undefined,
  defaultPrimary: string,
) {
  const out = new Uint8ClampedArray(source);
  for (let i = 0; i < out.length; i += 4) {
    const id =
      mask[i] > 0
        ? primary !== defaultPrimary
          ? primary
          : null
        : mask[i + 1] > 0 && effect && effect !== "ember"
          ? effect
          : null;
    if (!id || !source[i + 3]) continue;
    const hex = effectColor(id),
      target = [hex >> 16, (hex >> 8) & 255, hex & 255];
    const luminance =
      0.2126 * source[i] + 0.7152 * source[i + 1] + 0.0722 * source[i + 2];
    const base = 0.2126 * target[0] + 0.7152 * target[1] + 0.0722 * target[2];
    // A light cloth cannot keep the dark crimson's absolute brightness:
    // transfer its shading relative to the original material's midtone instead.
    const gamma = palettes[id].lightMaterialGamma;
    const original = effectColor(defaultPrimary);
    const reference =
      0.2126 * (original >> 16) +
      0.7152 * ((original >> 8) & 255) +
      0.0722 * (original & 255);
    const shade =
      gamma === undefined
        ? luminance / base
        : Math.pow(luminance / reference, gamma);
    for (let c = 0; c < 3; c++)
      out[i + c] = Math.round(Math.min(255, target[c] * shade));
  }
  return out;
}

export const paletteLabel = (id: string, role: "OATH" | "EMBER") =>
  id === "blue"
    ? role === "OATH"
      ? "Royal Blue"
      : "Deep Blue"
    : palettes[id].label;
