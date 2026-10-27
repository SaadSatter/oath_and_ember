import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
/** Native Playwright video is recorded continuously in two isolated contexts.
 * Close contexts before calling this function to finalize their WebM files.
 * No screenshots, timelapse, frame selection or speed filter is used. */
export async function combineNormalSpeedVideo(sieg:string,coco:string,output:string,ffmpeg='ffmpeg'):Promise<void> {
  await mkdir(dirname(output),{recursive:true});
  const args=['-y','-i',sieg,'-i',coco,'-filter_complex','[0:v]scale=960:720,setsar=1[left];[1:v]scale=960:720,setsar=1[right];[left][right]hstack=inputs=2[v]','-map','[v]','-c:v','libx264','-pix_fmt','yuv420p','-fps_mode','passthrough',output];
  await new Promise<void>((resolve,reject)=>{
    const process=spawn(ffmpeg,args,{stdio:['ignore','ignore','pipe']}); let error='';
    process.stderr.on('data',chunk=>{error=(error+String(chunk)).slice(-6000);});
    process.on('error',reject); process.on('exit',code=>code===0?resolve():reject(new Error(`Video assembly failed (${code}): ${error}`)));
  });
}
export const videoContextOptions={viewport:{width:960,height:720},recordVideo:{dir:'evaluation-artifacts/video',size:{width:960,height:720}}};
