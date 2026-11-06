import {it,expect} from "vitest";
import {spawnSync} from "node:child_process";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("../../../",import.meta.url));
it("live launcher admits the new B baseline with canonical casing and zero model calls",()=>{
 const temporary=mkdtempSync(join(tmpdir(),"oath-live-griffin-"));
 const out=join(temporary,"run");
 try {
  const result=spawnSync(process.execPath,["--import","tsx","scripts/midterm/live.ts","--scenario","GRIFFIN-UNPREPARED-RETURN-V1","--seed","0","--player","baseline-griffin-heuristic","--no-viewer","--no-open","--linger-seconds","0","--out",out],{cwd:root,encoding:"utf8",timeout:60000});
  expect(result.status,result.stderr+result.stdout).toBe(0);
  const summary=JSON.parse(readFileSync(join(out,"griffin-unprepared-return-v1-seed0","summary.json"),"utf8"));
  expect(summary.success).toBe(true);expect(summary.modelCalls).toEqual({attempted:0,failed:0,timedOut:0,unknownUsage:0});expect(summary.endHash).toBe("a454145029bba5ad3a669aca2852a4db768536a943946be6720f43435d51275c");
 }finally{rmSync(temporary,{recursive:true,force:true});}
},65000);
it("live launcher still refuses held-out S4 before starting a run",()=>{
 const r=spawnSync(process.execPath,["--import","tsx","scripts/midterm/live.ts","--scenario","S4","--seed","0","--player","baseline-griffin-heuristic","--no-viewer"],{cwd:root,encoding:"utf8",timeout:15000});expect(r.status).not.toBe(0);expect(r.stderr+r.stdout).toContain("held out");
});
