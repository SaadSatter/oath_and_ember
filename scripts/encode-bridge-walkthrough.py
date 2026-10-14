"""Combine two real Playwright recordings, synchronizing at the shared courtyard.
Usage: PYTHONPATH=/tmp/bridge-video-tools python3 scripts/encode-bridge-walkthrough.py SIEG.webm COCO.webm
Requires imageio-ffmpeg (encoder only); does not alter gameplay or stage timing.
"""
import json
import re
from datetime import datetime
import pathlib
import subprocess
import sys
import imageio_ffmpeg

root = pathlib.Path(__file__).resolve().parents[1]
folder = root / 'docs/puzzles/bridge-that-hates-cooperation'
report = json.loads((folder / 'recording-boulder/report.json').read_text())
events = report['events']
start = events[0]['time']
duration = events[-1]['time'] - start + 2.4
bold = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
font = '/System/Library/Fonts/Supplemental/Arial.ttf'
filters = [
    '[0:v]setpts=PTS-STARTPTS[a]', '[1:v]setpts=PTS-STARTPTS[b]',
    '[a][b]hstack=inputs=2:shortest=1,pad=1920:880:0:80:color=0x101e28'
]
def text_filter(text, x, y, size, color='white', enabled=None):
    result = f"drawtext=fontfile='{font}':text='{text}':x={x}:y={y}:fontsize={size}:fontcolor={color}"
    if enabled is not None:
        result += f":enable='{enabled}'"
    return result

filters[-1] += ',' + text_filter('The Bridge That Hates Cooperation', '(w-text_w)/2', 15, 34)
filters[-1] += ',' + text_filter('SIEG - West bank', 24, 56, 18, '0xe6b45b')
filters[-1] += ',' + text_filter('COCO - East bank', 984, 56, 18, '0xd7b8ff')
caption_map = {
    'Stage 1: boulder physically pushed onto plate A': 'Sieg pushes the same boulder onto weight plate A. Players cannot activate this plate.',
    "Stage 1: frontal moving-target hit opens Coco's gate": 'The weighted plate and a frontal moving-target hit permanently open the first gate.',
    "Stage 2: Coco's golden switch opens the spike corridor": 'Coco reaches her golden switch and opens the spike-trial route for Sieg.',
    'Same boulder retrieved and pushed to spike-trial start': 'Sieg physically retrieves the original boulder. Nothing teleports or follows automatically.',
    'Stage 3: push through three sideways spikes with both abilities': 'Super Speed restores pushing speed while Slow Time slows all three sliding spike traps.',
    'Spike reset preserves earlier gate and switch unlocks': 'Spike hit - retry from the spike-trial start. Earlier unlocks remain completed.',
    'Stage 3: same boulder holds golden plate B and stabilizes bridge 2': 'The boulder alone holds golden plate B, stabilizing the second bridge for Coco.',
    'Long frontal shot from bridge center permanently opens final gates': 'Coco shoots the distant front weak point from the bridge pad. Both final gates stay open.',

    'Stage 1: Coco shoots the moving east-bank target': 'Coco must shoot the sliding target on her bank. Sieg cannot reach his button until she hits it.',
    'Coco stays on the east bank; temple entrances open': 'Sieg lets go, then Coco fires the lock. Each enters the temple from their own bank.',
    'Shared southern courtyard': 'Start together. The two routes run along opposite river banks.',
    'Two occupants: bridge collapse': 'Try crossing together. Maximum capacity - one. The bridge collapses.',
    'Stage 1: separate routes opened': 'The moving target unlocks the west button. Sieg opens the gate for Coco.',
    'Stage 2: Slow Time and Super Speed': 'Slow Time slows the spike machinery to 20 percent. Super Speed restores normal movement for Sieg.',
    'Stage 2: Coco passes the relay gate': 'Sieg holds the relay until Coco passes her gate.',
    'Stage 3: false double plate triggers alarm': 'Both plates trigger an alarm. Wait, then let go.',
    'Stage 3: let go, then fire at the lock': 'Sieg steps off first. Coco fires a NEW spell to lock the bridge.',
    'Final bridge: one occupant at a time': 'The final bridge stays stable for one occupant at a time.',
    'Final: simultaneous opposite switches': 'Enter from separate banks. Hold the opposite temple switches together.',
    'Healthy boundaries: reunited at the temple': 'The temple opens. Congratulations on your healthy boundaries.',
    'Spike checkpoint: retrying the timing': 'The spike checkpoint gives them another try.'
}
for i, event in enumerate(events):
    begin = max(0, event['time'] - start)
    end = events[i + 1]['time'] - start if i + 1 < len(events) else duration
    caption = caption_map.get(event['label'], event['label']).replace("'", '')
    filters[-1] += ',' + text_filter(caption, '(w-text_w)/2', 823, 26, enabled=f'between(t,{begin:.3f},{end:.3f})')
encoder=imageio_ffmpeg.get_ffmpeg_exe()
created=[]
for source in sys.argv[1:3]:
    metadata=subprocess.run([encoder,'-i',source],capture_output=True,text=True).stderr
    match=re.search(r'creation_time\s*:\s*(\S+)',metadata)
    created.append(datetime.fromisoformat(match.group(1).replace('Z','+00:00')))
trim0=max(0,start-report['videoStarts'][0])
trimTimes=[max(0,trim0-(timestamp-created[0]).total_seconds()) for timestamp in created]
command = [encoder, '-y','-loglevel','error','-nostats']
for i, video in enumerate(sys.argv[1:3]):
    command += ['-ss', str(trimTimes[i]), '-i', video]
command += ['-filter_complex', ';'.join(filters), '-t', str(duration), '-r', '24', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-threads', '2', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', str(folder / 'walkthrough.mp4')]
subprocess.run(command,check=True)
(folder/'recording-boulder/encoding.json').write_text(json.dumps({'sourceVideos':sys.argv[1:3],'duration':duration,'trimTimes':trimTimes,'fps':24,'captionedEvents':events},indent=2)+'\n')
