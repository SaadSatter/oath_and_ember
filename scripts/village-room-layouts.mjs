// Authored world-space furnishing areas. Physics footprints are explicit here;
// source-sheet dimensions never decide gameplay collision. Rugs are non-solid.
const item = (kind, x, y, w, h, solid = true) => ({ kind, x, y, w, h, solid });
const rug = (x, y, w, h) => item("rug", x, y, w, h, false);
function authoredRoomLayout(id) {
  if (id === "STONEBRIDGE_INN_UPPER")
    return [
      item("bed", 112, 176, 56, 88),
      item("bed", 240, 176, 56, 88),
      item("bed", 392, 176, 56, 88),
      item("bed", 520, 176, 56, 88),
      item("bookcase", 112, 312, 40, 80),
      item("wardrobe", 528, 320, 40, 64),
      rug(224, 304, 192, 80),
      item("ovalTable", 288, 320, 64, 40),
      item("armchair", 240, 320, 32, 40),
      item("sideChairR", 368, 320, 32, 40),
    ];
  if (id.endsWith("_UPPER")) {
    const wide = id === "VILLAGE_APOTHECARY_UPPER";
    return [
      item("bed", 112, 176, 56, 88),
      item("bed", wide ? 520 : 392, 176, 56, 88),
      item("bookcase", 208, 176, 40, 80),
      item("wardrobe", 288, 176, 40, 64),
      item("plant", wide ? 448 : 352, 192, 32, 48),
      rug(136, 296, 200, 88),
      item("ovalTable", 208, 304, 64, 40),
      item("armchair", 152, 304, 32, 40),
      item("sideChairR", 296, 304, 32, 40),
    ];
  }
  if (id === "VILLAGE_ELDER_HOUSE")
    return [
      item("bookcase", 112, 176, 40, 80),
      item("bookcase", 168, 176, 40, 80),
      item("shelfBig", 224, 176, 64, 80),
      item("bed", 392, 176, 56, 88),
      rug(136, 288, 200, 96),
      item("armchair", 144, 304, 32, 40),
      item("ovalTable", 208, 304, 64, 40),
      item("sideChairR", 336, 304, 32, 40),
      item("vase", 376, 376, 32, 24),
      item("sack", 112, 384, 32, 32),
    ];
  if (id === "VILLAGE_APOTHECARY")
    return [
      item("cabinet", 112, 176, 40, 72),
      item("shelfBig", 192, 176, 64, 80),
      item("bookcase", 528, 176, 40, 80),
      item("plant", 352, 176, 32, 48),
      rug(192, 288, 288, 104),
      item("potionTable", 208, 304, 64, 64),
      item("table", 312, 312, 56, 48),
      item("potionTable", 400, 304, 64, 64),
      item("barrels", 112, 408, 64, 48),
      item("crate", 208, 416, 32, 32),
      item("plant", 472, 400, 32, 48),
      item("weaponRack", 528, 408, 48, 40),
    ];
  if (id === "STONEBRIDGE_INN")
    return [
      item("pantry", 112, 176, 96, 64),
      item("shelfBig", 240, 176, 64, 80),
      item("bookcase", 432, 176, 56, 80),
      item("plant", 544, 176, 32, 48),
      rug(136, 280, 136, 136),
      rug(328, 280, 136, 136),
      item("dining", 152, 296, 104, 48),
      item("dining", 344, 296, 104, 48),
      item("armchair", 176, 368, 32, 40),
      item("armchair", 368, 368, 32, 40),
      item("barrels", 112, 416, 64, 48),
    ];
  return [
    item("pantry", 112, 176, 96, 64),
    item("wardrobe", 256, 176, 40, 64),
    item("bed", 392, 176, 56, 88),
    rug(192, 280, 144, 104),
    item("dining", 208, 296, 80, 48),
    item("armchair", 240, 368, 32, 40),
    item("barrels", 112, 360, 48, 48),
    item("plant", 376, 368, 32, 48),
  ];
}
export function furnishingFootprint(o) {
  if (!o.solid) return null;
  const baseOnly = [
    "pantry",
    "wardrobe",
    "cabinet",
    "shelfBig",
    "bookcase",
    "shelf",
    "weaponRack",
    "plant",
    "vase",
  ].includes(o.kind);
  const inset = baseOnly ? Math.round(o.h * 0.5) : Math.round(o.h * 0.15);
  return { x: o.x, y: o.y + inset, w: o.w, h: o.h - inset };
}

// Window tiles extend to y=192. Keep every floor prop below that line and
// move tall east-side props away from the reserved stair area.
export function cleanRoomLayout(id) {
 return authoredRoomLayout(id).map(source => {
   const o={...source,y:source.y<200?source.y+24:source.y};
   if(!id.endsWith("_UPPER")&&["VILLAGE_COTTAGE","VILLAGE_ELDER_HOUSE","WILLOWBANK_HOME"].includes(id)&&o.kind==="bed")o.x=336;
   if(id==="VILLAGE_APOTHECARY"&&o.kind==="bookcase")o.x=464;
   return o;
 });
}
