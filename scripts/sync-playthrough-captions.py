import json,subprocess
from pathlib import Path
import numpy as np
ff='/tmp/bridge-video-tools/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1'
for kind in ['maze','pond']:
 folder=Path('docs/quests/bald-goddess/recording-'+kind);report=json.loads((folder/'report.json').read_text());starts=[]
 for video in report['videos']:
  raw=subprocess.check_output([ff,'-v','error','-i',video,'-t','8','-vf','fps=24,crop=960:40:0:596','-pix_fmt','rgb24','-f','rawvideo','-'])
  data=np.frombuffer(raw,dtype=np.uint8).reshape(-1,40,960,3);first=None
  for i,a in enumerate(data):
   golden=(a[:,:,0]>200)&(a[:,:,0]<255)&(a[:,:,1]>170)&(a[:,:,1]<235)&(a[:,:,2]>90)&(a[:,:,2]<175)
   edge=a[10,[1,10,20,940,950],:]
   if golden.sum()>120 and (edge[:,0]<50).all() and (edge[:,1]<70).all() and (edge[:,2]<80).all():first=i/24;break
  print(kind,Path(video).name,'first caption',first,'wallclock trim',(report['startedTimestamp']-report['videoStarts'][len(starts)])/1000)
  if first is None:raise RuntimeError('Caption not found')
  starts.append(first)
 report['captionSyncSeconds']=starts;(folder/'report.json').write_text(json.dumps(report,indent=2)+'\n')
