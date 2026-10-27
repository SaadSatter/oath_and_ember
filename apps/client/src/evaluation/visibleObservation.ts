/** Trusted presentation adapter. Never import World or network state here. */
export interface VisibleRect { x: number; y: number; width: number; height: number }
export interface RenderedObservation {
  provenance: 'rendered-display-list-and-visible-dom';
  viewport: { width: number; height: number };
  objects: { token: string; kind: 'text' | 'rendered-shape'; label?: 'Sieg' | 'Coco'; text?: string; screen: VisibleRect }[];
  text: string[];
  ui: { token: string; label: string }[];
}
export function installVisibleObservation(scene: Phaser.Scene): void {
  if (!new URLSearchParams(location.search).has('evaluationPresentation')) return;
  let actions = new Map<string, HTMLElement>();
  const visible = (element: HTMLElement): boolean => {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.right <= 0 || rect.bottom <= 0 || rect.left >= innerWidth || rect.top >= innerHeight) return false;
    for (let node: HTMLElement | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (node.hidden || node.hasAttribute('inert') || style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false;
      if (node instanceof HTMLDialogElement && !node.open) return false;
    }
    const hit = document.elementFromPoint(Math.max(0, rect.left + rect.width / 2), Math.max(0, rect.top + rect.height / 2));
    return !!hit && (element.contains(hit) || hit.contains(element));
  };
  const observe = (): RenderedObservation => {
    actions = new Map();
    const camera = scene.cameras.main;
    const canvas = scene.game.canvas;
    const viewport = { width: canvas.width, height: canvas.height };
    const objects: RenderedObservation['objects'] = [];
    // Bounds alone cannot establish visibility under rotated cameras or masks.
    // Omit ambiguous objects instead of exposing the underlying scene geometry.
    type RenderNode = Phaser.GameObjects.GameObject & { visible?: boolean; alpha?: number; mask?: unknown; getBounds?: () => VisibleRect; text?: unknown; scrollFactorX?: number; scrollFactorY?: number; parentContainer?: unknown; cameraFilter?: number; getData?: (key:string)=>unknown };
    scene.children.depthSort();
    const nodes = scene.children.getChildren() as RenderNode[];
    const candidates: { node: RenderNode; screen: VisibleRect }[] = [];
    if (((camera as unknown as {rotation?:number}).rotation ?? 0) === 0) for (const node of nodes) {
      if (!node.visible || node.alpha === 0 || node.parentContainer || !node.getBounds || ((node.cameraFilter ?? 0) & camera.id)) continue;
      const bounds = node.getBounds();
      const screen = {
        x: camera.x + (bounds.x - camera.scrollX * (node.scrollFactorX ?? 1) - camera.width / 2) * camera.zoom + camera.width / 2,
        y: camera.y + (bounds.y - camera.scrollY * (node.scrollFactorY ?? 1) - camera.height / 2) * camera.zoom + camera.height / 2,
        width: bounds.width * camera.zoom, height: bounds.height * camera.zoom,
      };
      if (![screen.x, screen.y, screen.width, screen.height].every(Number.isFinite) || screen.width <= 0 || screen.height <= 0) continue;
      candidates.push({ node, screen });
    }
    for (let i = 0; i < candidates.length; i++) {
      const { node, screen } = candidates[i];
      if (node.mask || screen.x < camera.x || screen.y < camera.y || screen.x + screen.width > camera.x + camera.width || screen.y + screen.height > camera.y + camera.height) continue;
      // Any later overlapping drawable can conceal the object. Conservative
      // omission avoids claiming hidden pixels or collision/passability truth.
      if (candidates.slice(i + 1).some(({ screen: r }) => screen.x < r.x + r.width && screen.x + screen.width > r.x && screen.y < r.y + r.height && screen.y + screen.height > r.y)) continue;
      const canvasBounds = canvas.getBoundingClientRect();
      const unobscuredByDom = [[screen.x + 1,screen.y + 1],[screen.x + screen.width - 1,screen.y + 1],[screen.x + 1,screen.y + screen.height - 1],[screen.x + screen.width - 1,screen.y + screen.height - 1],[screen.x + screen.width / 2,screen.y + screen.height / 2]].every(([x,y]) => document.elementFromPoint(canvasBounds.left + x * canvasBounds.width / canvas.width, canvasBounds.top + y * canvasBounds.height / canvas.height) === canvas);
      if (!unobscuredByDom) continue;
      const identity = node.getData?.('publicVisualIdentity');
      objects.push({ ...(identity === 'Sieg' || identity === 'Coco' ? { label: identity } : {}), token: crypto.randomUUID(), kind: typeof node.text === 'string' ? 'text' : 'rendered-shape', ...(typeof node.text === 'string' ? { text: node.text.slice(0, 1000) } : {}), screen });
    }
    const text = [...document.querySelectorAll<HTMLElement>('body *')].filter(el => el.children.length === 0 && !['SCRIPT', 'STYLE', 'OPTION'].includes(el.tagName) && visible(el)).map(el => el.innerText.trim()).filter(Boolean);
    const ui: RenderedObservation['ui'] = [];
    for (const button of document.querySelectorAll<HTMLElement>('button, [role="button"]')) {
      if (!visible(button) || button.matches(':disabled') || button.getAttribute('aria-disabled') === 'true') continue;
      const label = button.innerText.trim();
      if (!label) continue;
      const token = crypto.randomUUID(); actions.set(token, button); ui.push({ token, label });
    }
    return { provenance: 'rendered-display-list-and-visible-dom', viewport, objects, text, ui };
  };
  const bridge = { observe, activate: (token: string) => {
    const element = actions.get(token);
    if (!element || !visible(element) || element.matches(':disabled')) throw new Error('Stale or unavailable visible UI token');
    actions.delete(token); element.click();
  } };
  Object.defineProperty(window, '__evaluationPresentation', { configurable: true, value: bridge });
}
