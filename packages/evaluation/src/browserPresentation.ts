import type { Page } from '@playwright/test';
import type { GameRoom } from '../../../apps/server/src/GameRoom.js';
import type { EvaluationRole, PresentationBoundary } from './contract.js';
import { projectVisibleObservation, type VisibleObservation } from './observations.js';
export interface BrowserPlayer { page:Page; playerId:string }
/** Owned by the trusted host. Policies never receive a Page or this adapter. */
export class BrowserPresentation implements PresentationBoundary {
  private views = new Map<string, VisibleObservation>();
  constructor(private readonly players:Record<EvaluationRole,BrowserPlayer>, private readonly tickMs=1000/60, private readonly publishTick?:(room:GameRoom)=>void|Promise<void>) {}
  private player(id:string):BrowserPlayer {
    const value=Object.values(this.players).find(p=>p.playerId===id);
    if (!value) throw new Error('Unknown presentation player');
    return value;
  }
  async observe(_room:GameRoom,id:string,role:EvaluationRole):Promise<VisibleObservation> {
    if (this.players[role].playerId!==id) throw new Error('Role presentation mismatch');
    const view = await this.player(id).page.evaluate(() => {
      const bridge=(window as unknown as {__evaluationPresentation?:{observe():VisibleObservation}}).__evaluationPresentation;
      if (!bridge) throw new Error('Evaluation presentation is not ready');
      return bridge.observe();
    });
    const projected=projectVisibleObservation(view); this.views.set(id,projected); return projected;
  }
  legalActions(_room:GameRoom,id:string,_role:EvaluationRole) { return this.views.get(id)?.ui ?? []; }
  async activate(_room:GameRoom,id:string,token:string):Promise<void> {
    const view=this.views.get(id);
    if (!view?.ui.some(item=>item.token===token)) throw new Error('Stale or foreign UI token');
    // Consume before dispatch so replayed calls cannot double click.
    view.ui=view.ui.filter(item=>item.token!==token);
    await this.player(id).page.evaluate(token => {
      (window as unknown as {__evaluationPresentation:{activate(token:string):void}}).__evaluationPresentation.activate(token);
    },token);
  }
  async afterTick(room:GameRoom):Promise<void> {
    await this.publishTick?.(room);
    // Real wall-clock pacing preserves 1x footage; do not seek/accelerate frames.
    await new Promise<void>(resolve=>setTimeout(resolve,this.tickMs));
  }
}
