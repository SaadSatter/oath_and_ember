import type { World } from "../../../../packages/shared/src/gameTypes.js";
import {
  siegPalettes,
  cocoPalettes,
  magicPalettes,
  defaultAppearance,
  type CharacterAppearance,
} from "../../../../packages/shared/src/appearance.js";
import { heroNames } from "../assets/heroNames.js";
import { palettes, paletteLabel } from "../assets/palettes.js";
import { appearanceCanvas } from "../assets/appearanceTextures.js";
export function renderAppearanceLobby(
  panel: HTMLElement,
  world: World,
  myId: string,
  select: (a: CharacterAppearance) => void,
) {
  const area = document.createElement("div");
  area.className = "appearance-grid";
  for (const player of Object.values(world.players)) {
    if (!player.role) continue;
    const role = player.role,
      a = player.appearance || defaultAppearance(role),
      mine = player.id === myId;
    const card = document.createElement("section");
    card.className = "appearance-card";
    const title = document.createElement("strong");
    title.textContent = `${heroNames[role]} · ${mine ? "You" : "Partner"}`;
    card.append(title);
    const preview = document.createElement("canvas");
    preview.width = 48;
    preview.height = 64;
    preview.className = "hero-preview";
    preview.setAttribute("aria-label", `${heroNames[role]} appearance preview`);
    card.append(preview);
    void appearanceCanvas(role, a)
      .then((sheet) => {
        if (preview.isConnected)
          preview
            .getContext("2d")!
            .drawImage(sheet, 0, 0, 48, 64, 0, 0, 48, 64);
      })
      .catch(() => {});
    for (const [label, ids, field] of (role === "OATH"
      ? [["Scarf", siegPalettes, "primaryPalette"]]
      : [
          ["Outfit", cocoPalettes, "primaryPalette"],
          ["Magic", magicPalettes, "effectPalette"],
        ]) as [
      string,
      readonly string[],
      "primaryPalette" | "effectPalette",
    ][]) {
      const group = document.createElement("div");
      group.className = "palette-group";
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", `${heroNames[role]} ${label}`);
      const name = document.createElement("span");
      name.textContent = label;
      group.append(name);
      for (const id of ids) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "color-swatch";
        b.style.setProperty("--swatch", palettes[id].color);
        b.title = paletteLabel(id, role);
        b.setAttribute(
          "aria-label",
          `${heroNames[role]} ${label}: ${paletteLabel(id, role)}`,
        );
        b.setAttribute("aria-pressed", String(a[field] === id));
        b.disabled = !mine;
        b.onclick = () => select({ ...a, [field]: id } as CharacterAppearance);
        group.append(b);
      }
      card.append(group);
    }
    area.append(card);
  }
  panel.querySelector("#ready")!.before(area);
}
