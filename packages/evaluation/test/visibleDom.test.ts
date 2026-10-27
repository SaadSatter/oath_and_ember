import { it,expect } from 'vitest';
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
it.runIf(process.env.EVALUATION_BROWSER_TESTS === '1')('reads rendered DOM only, excluding closed dialogs, hidden clues and dropdown options',async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();
  await page.goto('about:blank?evaluationPresentation');
  await page.setContent('<p>Visible clue</p><div hidden>HIDDEN_FUTURE_CANARY</div><dialog><p>DIALOG_CANARY</p></dialog><select><option>OPTION_CANARY</option></select><button>Continue<span hidden>CHILD_CANARY</span></button>');
  await page.evaluate(() => { Object.defineProperty(crypto, 'randomUUID', { value: () => Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16)).join('-') }); });
  const source=await readFile('apps/client/src/evaluation/visibleObservation.ts','utf8');
  await page.addScriptTag({content:ts.transpileModule(source.replace(/^export /gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText});
  const result=await page.evaluate(()=>{
   const globals=window as unknown as {installVisibleObservation(scene:unknown):void;__evaluationPresentation:{observe():unknown}};
   globals.installVisibleObservation({cameras:{main:{width:640,height:360,x:0,y:0,zoom:1,scrollX:0,scrollY:0}},game:{canvas:{width:640,height:360}},children:{depthSort(){},getChildren:()=>[]}});
   return globals.__evaluationPresentation.observe();
  });
  const serialized=JSON.stringify(result); expect(serialized).toContain('Visible clue'); expect(serialized).toContain('Continue'); expect(serialized).not.toContain('CANARY');
 } finally {await browser.close();}
});
