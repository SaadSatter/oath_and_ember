/**
 * How a story scene frames its point, always at the screen's own pixel zoom
 * (pulling back on a small screen would halve the art and show the whole
 * map). The point and the local hero are framed together when both fit above
 * the dialogue box along the bottom of the screen; otherwise the point sits
 * near the top with as much below it as fits. An area (`span`) is centred and
 * only pulled back to fit when that costs no zoom below 1.
 */
export const DIALOGUE_COVER = 0.32;
/** Room kept above a framed point (a statue's head). */
const HEADROOM = 90;
export function storyFraming(
  target: { x: number; y: number; span?: { w: number; h: number } },
  hero: { x: number; y: number } | null,
  viewWidth: number,
  viewHeight: number,
  // Screen pixels per world pixel; kept for callers, zoom never drops below 1.
  _pixel: number,
) {
  if (target.span) return { x: target.x, y: target.y, zoom: 1 };
  const usable = viewHeight * (1 - DIALOGUE_COVER),
    top = target.y - HEADROOM;
  if (hero) {
    const bottom = hero.y + 40,
      left = Math.min(target.x, hero.x) - 110,
      right = Math.max(target.x, hero.x) + 110;
    if (bottom - top <= usable && right - left <= viewWidth)
      return {
        x: (left + right) / 2,
        y: top - (usable - (bottom - top)) / 2 + viewHeight / 2,
        zoom: 1,
      };
    // The hero does not fit: keep the point near the top of the screen.
    return { x: target.x, y: top + viewHeight / 2, zoom: 1 };
  }
  return { x: target.x, y: target.y, zoom: 1 };
}
