"""Synchronize the two real-client recordings into one side-by-side MP4."""
import json
from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parents[1]
folder=ROOT/'docs/quests/bald-goddess/recording-maze'
report=json.loads((folder/'report.json').read_text())
encoder=Path('/tmp/bridge-video-tools/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1')
if not encoder.exists():
    import imageio_ffmpeg
    encoder=Path(imageio_ffmpeg.get_ffmpeg_exe())
trim=report.get('captionSyncSeconds') or [max(0,(report['startedTimestamp']-s)/1000) for s in report['videoStarts']]
font='/System/Library/Fonts/Supplemental/Arial.ttf'
filters=("[0:v]setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];"
         "[a][b]hstack=inputs=2:shortest=1,pad=1920:780:0:60:color=0x0c1820,"
         f"drawtext=fontfile='{font}':text='HEDGE MAZE - FULL TWO-PLAYER RUN - 2x SPEED':x=(w-text_w)/2:y=10:fontsize=23:fontcolor=0xf4d186,"
         f"drawtext=fontfile='{font}':text='SIEG':x=24:y=37:fontsize=17:fontcolor=0xf4d186,"
         f"drawtext=fontfile='{font}':text='COCO':x=984:y=37:fontsize=17:fontcolor=0xd8b9ff")
cmd=[str(encoder),'-y','-loglevel','error']
for t,video in zip(trim,report['videos']):cmd+=['-ss',str(t),'-i',video]
cmd+=['-filter_complex',filters,'-c:v','libx264','-preset','veryfast','-crf','20','-r','24','-pix_fmt','yuv420p','-threads','2','-an','-movflags','+faststart',str(folder/'maze-playthrough.mp4')]
subprocess.run(cmd,check=True)
subprocess.run([str(encoder),'-y','-loglevel','error','-ss','14','-i',str(folder/'maze-playthrough.mp4'),'-frames:v','1',str(folder/'preview.png')],check=True)
print(folder/'maze-playthrough.mp4')
