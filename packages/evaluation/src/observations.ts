/** Policy-safe serialized presentation contract; no authoritative game types. */
export interface VisibleObservation {
  provenance: 'rendered-display-list-and-visible-dom';
  viewport: {width:number;height:number};
  objects: {token:string;kind:'text'|'rendered-shape';label?:'Sieg'|'Coco';text?:string;screen:{x:number;y:number;width:number;height:number}}[];
  text:string[];
  ui:{token:string;label:string}[];
}
/** Explicit projection prevents accidental DOM attributes or private state leakage. */
export function projectVisibleObservation(value: VisibleObservation): VisibleObservation {
  return {
    provenance:'rendered-display-list-and-visible-dom',
    viewport:{width:value.viewport.width,height:value.viewport.height},
    objects:value.objects.map(o=>({token:o.token,kind:o.kind,...(o.label === "Sieg" || o.label === "Coco" ? {label:o.label}:{}),...(o.text === undefined ? {} : {text:o.text}),screen:{x:o.screen.x,y:o.screen.y,width:o.screen.width,height:o.screen.height}})),
    text:[...value.text],ui:value.ui.map(({token,label})=>({token,label})),
  };
}
