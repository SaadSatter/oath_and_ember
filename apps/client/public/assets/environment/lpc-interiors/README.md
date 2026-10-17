# LPC village interior artwork

Distributed under Creative Commons Attribution-ShareAlike 3.0 Unported:
https://creativecommons.org/licenses/by-sa/3.0/

- `interior.png`: **[LPC] House interior and decorations**, by Tuomo Untinen
  (Reemax), based on artwork by Lanea Zimmerman (Sharm), Hyptosis, Daniel
  Eddeland (daneeklu), William Thompson, wulax and Matthew Krohn (makrohn).
  https://opengameart.org/content/lpc-house-interior-and-decorations
  See `CREDITS-original.txt` for the author's detailed per-object credits,
  including Manuel Riecke, Johannes Sjölund and caeles.
- `house_inside.png`: **[LPC] House Insides**, by Lanea Zimmerman (Sharm),
  with castle light sources by Daniel Armstrong (HughSpectrum), repacked by
  William Thompson (William.Thompsonj).
  https://opengameart.org/content/lpc-house-insides

Original sheets are unmodified. Oath and Ember selects rectangular frames,
scales them with nearest-neighbor filtering, and composes new room layouts.
These artwork arrangements/adaptations are also available under CC-BY-SA 3.0.
The license applies to this artwork, not to unrelated game source code.

Source archive and upstream credits are preserved in
`Images/asset-sources/lpc-house-interiors`. Rebuild placements with
`node scripts/build-lpc-village-interiors.mjs` after regenerating room layouts.
The renderer replaces furniture layers and floors in the three village homes;
existing room boundaries, door locations and authoritative collision stay intact.
