import { readFile } from 'node:fs/promises';
/** Audit a policy-safe serialization for explicit hidden-state canaries. */
export function assertNoHiddenCanaries(observation:unknown,canaries:readonly string[]):void {
  const serialized=JSON.stringify(observation);
  for (const canary of canaries) if (canary && serialized.includes(canary)) throw new Error('Hidden-state canary leaked into observation');
}
/** Adapter provenance check is intentionally narrow: never silently replace the
 * rendered observer with a World-derived shortcut. Integration tests still need
 * to exercise the renderer against occlusion and hidden DOM fixtures. */
export async function auditObserverSource(path:string):Promise<void> {
  const source=await readFile(path,'utf8');
  if (/from\s+['"][^'"]*(?:gameTypes|NetworkClient|shared\/)/.test(source) || /\bnet\.world\b/.test(source)) throw new Error('Observer imports authoritative state');
  if (!source.includes('getChildren()') || !source.includes('getComputedStyle')) throw new Error('Missing rendered observer provenance');
}
