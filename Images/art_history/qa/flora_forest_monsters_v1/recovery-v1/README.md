# Checkerboard recovery investigation

All three: UNSAFE_TO_RECOVER with spatial_checkerboard_conservative_v1. This is a conservative-method result, not proof that every possible manual recovery is impossible. Pattern irregularity and blended JPEG edge pixels prevent safe automatic foreground separation under the requested no-guessing rule. No candidate.png exists and no pixel removal occurred. The opaque alpha/contrast/contact sheets document that stop, not a successful extraction.

Primary review: review.html. Each creature has comparison.png, edges-4x.png, alpha.png, contact-sheet.png, uncertainty.png and report.json. Fine-structure inspection found pale/gray fringes around Mossling leaves/twigs and fingers; orange/gray blends near Wisp flame and branch tips; gray rings around Sentinel outlines. These cannot be inverted to original foreground RGB/alpha without assumptions.

The algorithm fits two alternating grayscale levels and lattice periods against clear outer strips, validates the independent border, requires >95% agreement, and only considers pattern-matching pixels reachable from the perimeter. A protected 2px band around definite foreground and every uncertain pixel remains opaque. Color similarity alone never authorizes removing enclosed armor/stone. Parameters are fixed in the versioned implementation, no AI/provider calls occur, and repeatable synthetic tests cover pale enclosed foreground and failed-fit preservation. A successful diagnostic would still be NEEDS_HUMAN_REVIEW, never approved.

Explicit command (requires Python with Pillow and NumPy):
`npm run art:inspect -- --prepare-checkerboard SOURCE.jpg --out NEW_OUTPUT_DIRECTORY --columns 4 --rows 4 --python PYTHON_EXECUTABLE`

Existing output directories are refused. Use a fresh version to preserve attempts. Normal art:inspect remains read-only; preparation is never invoked automatically. Do not resume integration from these failed diagnostics. Original transparent exports or a separate explicitly reviewed manual preparation are required.
