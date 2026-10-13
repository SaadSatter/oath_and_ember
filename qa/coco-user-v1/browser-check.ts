import { chromium } from '@playwright/test';
import { createApp } from '../../apps/server/src/app.js';
import { writeFileSync } from 'node:fs';
const app = createApp({ encounter: true });
await new Promise<void>(r => app.http.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors:string[]=[];
try {
 const pages=await Promise.all([0,1].map(async()=>{const p=await browser.newPage({viewport:{width:1280,height:720}});p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://127.0.0.1:${(app.http.address() as any).port}/?enemyQA=1`);return p;}));
 await pages[0].locator('#create').click(); await pages[0].locator('#oath').waitFor();
 const code=(await pages[0].locator('h1').textContent())!.split(' ')[1];
 await pages[1].locator('#code').fill(code);await pages[1].locator('#join').click();
 await pages[0].locator('#oath').click();await pages[1].locator('#ember').click();
 await pages[0].locator('#ready').click();await pages[1].locator('#ready').click();
 await pages[0].waitForFunction(()=>document.body.dataset.playing==='true');
 await Promise.all(pages.map(p=>p.keyboard.down('d')));await new Promise(r=>setTimeout(r,650));await Promise.all(pages.map(p=>p.keyboard.up('d')));
 await new Promise(r=>setTimeout(r,1000));
 const views=[];
 for(const [i,p] of pages.entries()){await p.screenshot({path:`qa/coco-user-v1/client-${i+1}.png`});views.push(await p.locator('#game').getAttribute('data-enemy-visuals'));}
 writeFileSync('qa/coco-user-v1/browser-result.json',JSON.stringify({errors,views},null,2));
 if(errors.length)throw Error(errors.join('\n'));
 console.log('Two browser clients rendered successfully.');
}finally{await browser.close();await app.close();}
