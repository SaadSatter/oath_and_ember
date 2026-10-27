import { describe,it,expect } from 'vitest';
import { projectVisibleObservation, type VisibleObservation } from '../src/observations.js';
import { assertNoHiddenCanaries,auditObserverSource } from '../src/visibilityAudit.js';
import { BrowserPresentation } from '../src/browserPresentation.js';
import type { Page } from '@playwright/test';
import type { GameRoom } from '../../../apps/server/src/GameRoom.js';
const view:VisibleObservation={provenance:'rendered-display-list-and-visible-dom',viewport:{width:640,height:360},objects:[],text:['A visible inscription'],ui:[{token:'current',label:'Continue'}]};
describe('rendered observation boundary',()=>{
 it('projects fields explicitly without hidden-state or attribute canaries',()=>{
  const projected=projectVisibleObservation({...view,world:{answer:'SECRET_CANARY'},attributes:{solution:'SECRET_CANARY'}} as VisibleObservation);
  assertNoHiddenCanaries(projected,['SECRET_CANARY']); expect(projected.text).toEqual(view.text);
 });
 it('keeps authoritative state imports out of the client observer',async()=>{
  await auditObserverSource('apps/client/src/evaluation/visibleObservation.ts');
 });
 it('rejects foreign and consumed UI tokens before browser dispatch',async()=>{
  const page={evaluate:async(fn:unknown,arg?:string)=>arg ? undefined : structuredClone(view)} as unknown as Page;
  const boundary=new BrowserPresentation({SIEG:{page,playerId:'s'},COCO:{page,playerId:'c'}},0);
  const room={} as GameRoom;
  await boundary.observe(room,'s','SIEG');
  await expect(boundary.activate(room,'c','current')).rejects.toThrow('foreign');
  await expect(boundary.observe(room,'s','COCO')).rejects.toThrow('mismatch');
  await boundary.activate(room,'s','current');
  await expect(boundary.activate(room,'s','current')).rejects.toThrow('Stale');
 });
});
