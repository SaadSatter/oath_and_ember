"""Review-only SVG map plans. No gameplay or PixelLab operations."""
from pathlib import Path
from html import escape
import base64
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/quests/bald-goddess/layouts'
OUT.mkdir(parents=True,exist_ok=True)
C={'bg':'#0c1820','panel':'#142630','ink':'#eef1df','muted':'#aec2c6','gold':'#f4c973','coco':'#d4a9ff','water':'#15556b','cyan':'#6bd7e5','ground':'#314d37','path':'#697063','hedge':'#174d34','red':'#f48e87'}
class Plan:
 def __init__(self,slug,title,subtitle,w,h):
  self.slug=slug;self.w=w;self.h=h;self.s=min(900/w,744/h);self.x=68+(900-w*self.s)/2;self.y=190
  self.a=[f'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1220" viewBox="0 0 1600 1220"><defs><marker id="gold" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="{C["gold"]}"/></marker><marker id="coco" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="{C["coco"]}"/></marker><marker id="cyan" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="{C["cyan"]}"/></marker></defs>']
  self.a[0]=self.a[0].replace('</defs>','<marker id="red" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="#f48e87"/></marker></defs>')
  self.rect(0,0,1600,1220,C['bg']);self.text(title,48,55,32,C['gold'],True);self.text(subtitle,48,91,19);self.text('PROPOSED LAYOUT  •  Top-down  •  32px logical tiles  •  Plan only — not implemented',48,125,17,C['muted'])
  self.text('NORTH ↑',68,168,15,C['cyan'],True)
  self.rect(self.x,self.y,w*self.s,h*self.s,C['ground'],stroke='#66876d',width=2)
 def rect(self,x,y,w,h,fill,stroke=None,width=1,rx=0,extra=''):
  self.a.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke or "none"}" stroke-width="{width}" {extra}/>')
 def text(self,t,x,y,size=16,color=None,bold=False,anchor='start'):
  self.a.append(f'<text x="{x}" y="{y}" font-family="Arial,sans-serif" font-size="{size}" fill="{color or C["ink"]}" font-weight="{700 if bold else 400}" text-anchor="{anchor}">{escape(t)}</text>')
 def pt(self,x,y):return self.x+x*self.s,self.y+y*self.s
 def tile(self,x,y,w,h,fill,stroke=None,extra=''):
  a,b=self.pt(x,y);self.rect(a,b,w*self.s,h*self.s,fill,stroke,2,extra=extra)
 def label(self,t,x,y,color=None,size=14):
  a,b=self.pt(x,y);self.text(t,a,b,size,color,True,'middle')
 def dot(self,x,y,r,fill,stroke=None,extra=''):
  a,b=self.pt(x,y);self.a.append(f'<circle cx="{a}" cy="{b}" r="{r*self.s}" fill="{fill}" stroke="{stroke or C["ink"]}" stroke-width="2" {extra}/>')
 def route(self,pts,color='gold',dash=False,width=3):
  path=' '.join(('M' if i==0 else 'L')+f'{self.pt(x,y)[0]},{self.pt(x,y)[1]}' for i,(x,y) in enumerate(pts))
  self.a.append(f'<path d="{path}" fill="none" stroke="{C.get(color,color)}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round" {"stroke-dasharray=\"8 7\"" if dash else ""} marker-end="url(#{color if color in ["gold","coco","cyan","red"] else "cyan"})"/>')
 def token(self,t,x,y,color='gold',r=.72):
  self.dot(x,y,r,C.get(color,color),C['bg']);self.label(t,x,y+.22,C['bg'],15)
 def portal(self,t,x,y):self.token(t,x,y,'cyan',1);self.dot(x,y,1.3,'none',C['cyan'])
 def chest(self,x,y,t):
  self.tile(x-1,y-.7,2,1.4,'#966334',C['gold']);self.tile(x-.13,y-.7,.26,1.4,C['gold']);self.label(t,x,y+1.65,C['gold'],13)
 def grid(self):
  for x in range(self.w+1):
   a,b=self.pt(x,0);self.a.append(f'<path d="M{a},{b} v{self.h*self.s}" stroke="#ffffff" stroke-opacity=".055"/>')
   if x%4==0:self.text(str(x),a,self.y-8,11,C['muted'],anchor='middle')
  for y in range(self.h+1):
   a,b=self.pt(0,y);self.a.append(f'<path d="M{a},{b} h{self.w*self.s}" stroke="#ffffff" stroke-opacity=".055"/>')
   if y%4==0:self.text(str(y),self.x-13,b+4,11,C['muted'],anchor='end')
 def card(self,n,title,lines,y,color='gold'):
  height=47+len(lines)*24;self.rect(1030,y,518,height,C['panel'],stroke='#34505c',rx=12)
  self.text(n+'  '+title,1050,y+29,20,C.get(color,color),True)
  for i,line in enumerate(lines):self.text(line,1050,y+58+i*24,16)
  return y+height+18
 def footer(self,solution,safety):
  self.rect(48,991,1500,174,C['panel'],stroke='#34505c',rx=12)
  self.text('EXPECTED COOPERATIVE ROUTE',68,1020,17,C['gold'],True)
  for i,line in enumerate(solution):self.text(line,68,1046+i*24,17)
  self.text(safety,68,1142,15,C['muted'])
  self.text('Gold: Sieg / physical  •  Purple: Coco / magic  •  Cyan: mechanism / return  •  Dashed: link or conditional access',48,1194,15,C['muted'])
 def save(self):
  self.a.append('</svg>');(OUT/(self.slug+'.svg')).write_text(''.join(self.a))
# SHRINE
p=Plan('01-goddess-shrine','THE BALD GODDESS · GODDESS SHRINE','Central hub + shared southern Start / Return courtyard  ·  40 × 32 tiles',40,32)
for r in [(12,7,16,17),(2,15,10,6),(28,15,10,6),(17,2,6,5),(17,24,6,7),(12,25,16,6)]:p.tile(*r,C['path'])
p.grid()
for x,y in [(5,6),(8,10),(5,25),(34,6),(31,10),(35,26),(12,3),(28,3)]:p.dot(x,y,1.7,'#1d6640','#6a9a60')
p.tile(17.5,11.4,5,2.2,'#8c8571',C['gold'],extra='stroke-dasharray="5 4"')
source=ROOT/'Images/Maps/Bald_Goddess_Statue_crying_in/Bald_Goddess_Statue_crying_in/rotations/Bald_Goddess_Statue_crying_in.png'
x,y=p.pt(17.2,6.9);s=5.6*p.s
p.a.append(f'<image x="{x}" y="{y}" width="{s}" height="{s}" href="data:image/png;base64,{base64.b64encode(source.read_bytes()).decode()}" style="image-rendering:pixelated"/>')
p.label('BALD GODDESS',20,14.6,C['gold'],17);p.token('A',20,17,'coco');p.label('Offering position',20,19,C['coco'])
p.portal('W',2.4,18);p.portal('E',37.6,18);p.portal('N',20,2.4);p.portal('S',20,30)
p.label('MIRROR POND',7,23,C['cyan']);p.label('HEDGE MAZE',33,23,C['cyan']);p.label('GRIFFIN ENCLOSURE',20,5.7,C['cyan'])
p.token('S',18.5,27.5);p.token('C',21.5,27.5,'coco');p.label('START TOGETHER',20,25.6,C['ink'],16)
p.route([(20,29),(20,21),(20,18)],'cyan',True);p.route([(15,18),(4,18)],'cyan');p.route([(25,18),(36,18)],'cyan');p.route([(25,15),(25,8),(20,8),(20,4)],'cyan')
y=190
y=p.card('01','ALL THREE BRANCHES OPEN',['West → Mirror Pond / Vanity Mirror.','East → Hedge Maze / Enchanted Shears.','North → Griffin / Magnificent Wig.','Every branch returns to this same hub.'],y,'cyan')
y=p.card('02','A · OFFERING INTERACTION',['E interacts for either hero at the plinth.','Select a shared inventory item to offer.','Wrong offerings: humorous reply, no loss.','Wig: one atomic quest completion.'],y,'coco')
y=p.card('03','SHARED INVENTORY',['One room inventory, visible to both heroes.','No trading or duplicate personal copies.','Local item selection; server validates use.'],y)
y=p.card('04','VISUAL / COLLISION NOTES',['Use supplied crying → happy statue art.','Happy statue still needs a visible wig.','Roof overhang is decorative, not a wall.','Paths: 6 tiles; plinth footprint outlined.'],y,'cyan')
p.footer(['Start together in the southern courtyard; explore any branch in any order.','Use clues from the goddess, collect the shared tools, earn the wig, then return to A.','Proposed south connection: existing Forest Ruins. Final campaign placement remains reviewable.'],'Failure: wrong offerings consume nothing. Branch rewards persist. E never activates Push.');p.save()
# MAZE
p=Plan('02-hedge-maze','THE BALD GODDESS · HEDGE MAZE','East branch · revised: burnable hedge, cow blockade and key-runner chase · 48 × 40 tiles',48,40)
p.tile(0,0,48,40,C['hedge'],'#76a467')
maze_paths=[(2,32,18,4),(6,24,10,4),(6,18,4,14),(12,20,4,12),(2,18,4,4),(12,18,4,2),(12,36,4,2),(20,30,10,8),(24,12,4,18),(18,23,6,4),(20,27,2,5),(28,16,8,4),(8,4,32,4),(8,12,32,4),(8,4,4,12),(36,4,4,12),(2,4,6,4),(4,12,4,4),(16,8,4,2),(28,10,4,2),(36,16,4,6),(40,12,6,4),(42,2,4,14)]
for r in maze_paths:p.tile(*r,'#607c50')
p.tile(0,32,2,4,'#607c50')
p.grid();p.portal('W',1.5,34);p.label('TO SHRINE',7,37.3,C['cyan'],12);p.token('S',4,33);p.token('C',4,35,'coco')
p.dot(8,20,1,'#84957a',C['ink']);p.label('OLD WELL',8,18.6,C['muted'],11)
p.dot(14,18.8,.6,'#9e997f',C['ink']);p.label('RUIN',14,17,C['muted'],11)
p.label('LOOPS + DEAD ENDS',13,29.7,C['muted'],11)
# One identifiable, permanent burn-through. No other hedge is burnable.
p.tile(18,32,2,4,'#a65e2b','#ffca6c');p.token('B',19,34,'red',.85)
p.route([(14,34),(17.6,34)],'coco');p.label('ONE DRY HEDGE',22,39,C['red'],12)
p.route([(5,33),(16,33),(17.5,33)],'gold',True)
# The cow body spans the four-tile lane. Side bay has no route around its north edge.
p.tile(24,23,4,4,'#e9e0c9','#463e33')
for x,y in [(24.9,24),(26.6,25.7),(27,23.8)]:p.dot(x,y,.4,'#51483f','#51483f')
p.label('COW',26,25.3,C['bg'],13)
p.tile(21.8,23,4,4,'none',C['gold'],extra='stroke-dasharray="5 4"')
p.route([(26,25),(23.8,25)],'gold',True);p.dot(23.8,25,3,'none',C['coco'],extra='stroke-dasharray="6 4"')
p.token('BH',23.8,25,'coco',.7);p.token('C',20.5,25,'coco',.65)
p.label('SIDE BAY',20.8,22,C['gold'],11);p.label('2',29.4,25,C['gold'],18)
p.route([(21,34),(21,28),(20.5,26)],'coco',True)
p.route([(27,34),(27,29),(27,21),(27,16)],'gold')
# Runner chooses navigable escape paths away from both heroes; arrows are alternatives, not a patrol.
p.route([(20,14),(10,14),(10,9)],'red',True)
p.route([(20,14),(25,14),(31,14)],'red',True)
p.route([(10,9),(10,6),(16,6)],'red',True)
p.token('R',20,14,'red',.85);p.label('FAST KEY RUNNER',23,11,C['red'],12)
p.token('S',28,14,'gold',.65);p.route([(27,15.5),(22,15.5)],'gold')
p.token('C',32,18,'coco',.7);p.label('SLOW TIME',32,20.9,C['coco'],11)
p.label('3 · REACTIVE ESCAPE PATHS',24,3,C['gold'],13)
p.tile(40,12,2,4,'#977746',C['gold']);p.token('K',41,14,'gold',.7)
p.chest(44,5,'SHEARS');p.label('KEY GATE',44,17.5,C['gold'],12)
p.route([(38.5,14),(39.4,14)],'gold');p.route([(44,12),(44,7)],'gold',True)
# Five encounter monsters in two groups, separate from the existing key runner.
for name,x,y in [('M',9,25.5),('W',14,30.5),('M',24.9,35.5),('W',28.5,32),('I',26,29)]:
 p.token(name,x,y,'red',.65)
p.label('2 MONSTERS · BEFORE BUSH',10,23.2,C['red'],10)
p.label('3 MONSTERS · BEFORE COW',33,28.5,C['red'],10)
y=190
y=p.card('01','B · BURN A WAY FORWARD',['Coco fires at the one dry, marked bush.','It burns away and stays open.','Other hedges stay solid, even in Flight.','Before bush: 1 Mossling + 1 Cinder Wisp.'],y,'coco')
y=p.card('02','MOVE THE LARGE COW',['The cow blocks the full forward passage.','Coco casts Black Hole from the side bay.','The impact vortex pulls it sideways; Sieg','passes through the newly cleared space.','Before cow: 1 Mossling + 1 Wisp + 1 Sentinel.'],y)
y=p.card('03','SLOW TIME + SUPER SPEED CHASE',['Coco slows the fast runner; Sieg sprints','after it and holds E to tag / take the key.','Flees either hero; picks safe escape branches.','Runner resists Black Hole; no ranged key grab.','Key enters the shared inventory once.'],y,'coco')
y=p.card('04','K · KEY OPENS THE CHEST GATE',['Use the shared key on gate K.','Open the chest for Enchanted Hedge Shears.','Key use + gate opening is one transaction.','Cow parking / burned hedge persist on retry.'],y,'cyan')
p.footer(['Five encounter monsters: M = Mossling ×2; W = Cinder Wisp ×2; I = Iron Sentinel ×1. Key runner is separate.','Runner flees both heroes instead of circling. Coordinate Slow Time + Super Speed, then hold E to tag.','Sentinel uses its existing starter sprite; attacks remain unimplemented. Cow remains harmless and immune to damage.'],'Retry: reset only the uncaught runner, never a collected key. No cow teleport, friendly damage, or key duplication.');p.save()
# POND
p=Plan('03-mirror-pond','THE BALD GODDESS · MIRROR POND','West branch · revised: spike entry, perimeter mirrors and protected torches · 48 × 40 tiles',48,40)
# A complete 4-tile perimeter circuit encloses the pond. Outside terrain is blocked.
p.tile(4,4,36,28,C['path']);p.tile(8,8,28,20,C['water'],C['cyan'])
for r in [(4,2,36,2),(2,4,2,28),(4,32,36,2),(40,4,2,20),(40,28,2,2),(40,32,2,2)]:p.tile(*r,'#455451','#9aaba4')
p.tile(42,24,6,14,C['path']);p.tile(36,24,8,4,C['path'])
# Southern perimeter is walled off. Coco enters pond through a separate water culvert.
p.tile(4,28,36,1,'#455451','#9aaba4')
p.tile(40,30,2,2,C['water'],C['cyan'])
# Guards make the moving spike crossing an actual timing corridor.
p.tile(40,24,4,1,'#455451','#9aaba4');p.tile(40,27,4,1,'#455451','#9aaba4')
for r in [(24.5,10.5,5,3),(14.5,16.5,3,3),(20.5,24,3,3)]:p.tile(*r,'#83937b','#c1c9aa')
# Submerged center is a conditional outline, not an available landing platform.
p.tile(20,15,8,8,C['water'],C['gold'],extra='stroke-dasharray="6 5"')
# Pond-side ward blocks Coco landing on the perimeter; spells pass through.
p.tile(8,8,28,20,'none',C['coco'],extra='stroke-dasharray="3 5"')
# Center platform and its bridge rise together on the fourth torch.
p.tile(26,23,2,7,C['water'],C['gold'],extra='stroke-dasharray="6 5"')
# No southern return bridge: the southern perimeter remains sealed.
p.grid();p.portal('E',46.5,34);p.label('TO SHRINE',43.3,39,C['cyan'],12)
p.token('S',44.5,33);p.token('C',44.5,36,'coco')
# Entry spikes move vertically across a horizontal guarded lane.
for x,y in [(37,25.7),(39,26.3)]:
 p.tile(x-.45,y-.8,.9,1.6,'#c57168',C['red']);p.route([(x,22.5),(x,29.5)],'red',True,2)
p.label('EAST SPIKE ENTRY ↑↓',41,22,C['red'],12)
p.label('SOUTH PERIMETER · SOLID WALL',22,33.5,C['muted'],12)
p.route([(45,30),(45,26),(38,26),(38,16)],'gold')
p.route([(44,35),(44,31),(41,31),(37,31),(34,25),(31,22)],'coco',True)
p.label('WATER CULVERT ↓',35.2,34.7,C['coco'],11)
# Narrow diagonal spell ports through the perimeter walls; too small for actors.
for start,end in [((40,10),(42,8)),((24,4),(22,2)),((4,16),(2,14)),((20,32),(18,34))]:
 x1,y1=p.pt(*start);x2,y2=p.pt(*end)
 p.a.append(f'<path d="M{x1},{y1} L{x2},{y2}" stroke="#0c1820" stroke-width="8"/>')
# All four reflection geometries use a different mirror-surface angle.
mirrors=[('M1',(38,12),(28,12),(44,6),-22.5,90),('M2',(26,6),(26,12),(21,1),67.5,0),('M3',(6,18),(16,18),(1.5,13.5),22.5,90),('M4',(22,30),(22,25),(17,35),112.5,0)]
import math
for i,(name,m,a,t,angle,rest) in enumerate(mirrors,1):
 # Dashed rest line is parallel to Sieg's travel; active mirror leaf spans the lane.
 for theta,color,dashed in [(rest,'#b7c1bb',True),(angle,C['gold'],False)]:
  dx=1.95*math.cos(math.radians(theta));dy=1.95*math.sin(math.radians(theta));x1,y1=p.pt(m[0]-dx,m[1]-dy);x2,y2=p.pt(m[0]+dx,m[1]+dy)
  p.a.append(f'<path d="M{x1},{y1} L{x2},{y2}" stroke="{color}" stroke-width="{3 if dashed else 7}" {"stroke-dasharray=\"4 4\"" if dashed else ""}/>')
 p.token('A'+str(i),a[0],a[1],'coco',.65)
 p.route([a,m],'coco');p.route([m,t],'cyan',True)
 p.tile(t[0]-1,t[1]-.8,2,1.6,'#333f40','#b2beb7');p.token('T'+str(i),t[0],t[1],'red',.65)
 # Tiny projectile apertures behind the wall remain too narrow for players.
 if i==1:p.label('M1  −22.5°',32.5,9.2,C['gold'],12)
 if i==2:p.label('M2  67.5°',28,8.9,C['gold'],12)
 if i==3:p.label('M3  22.5°',10.4,15.2,C['gold'],12)
 if i==4:p.label('M4  112.5°',22,27,C['gold'],12)
p.route([(38.7,10),(38.7,6),(30,6)],'gold',True);p.route([(23,6.8),(6.8,6.8),(6.8,15)],'gold',True);p.route([(5.1,21),(5.1,30),(18,30)],'gold',True);p.route([(25,30.8),(38,30.8)],'gold',True)
p.chest(24,18.4,'CHEST RISES WITH PLATFORM');p.label('SUBMERGED UNTIL 4 TORCHES',24,21.5,C['gold'],10)
y=190
y=p.card('01','SIEG · TIMED SPIKE ENTRY',['Spikes cross the EAST perimeter entrance.','Only boosted Sieg can clear the timed gap.','Coco cannot enter or fly over the trap.','A solid wall seals the southern perimeter.','Coco enters water via a separate culvert.'],y)
y=p.card('02','PUSH → SHOOT → RESET',['Sieg pushes a mirror into reflecting angle.','Coco flies to A1–A4 and fires at that mirror.','The shot reflects into its protected torch.','Sieg resets the mirror to its resting angle,','reopening his lane to reach the next station.'],y,'coco')
y=p.card('03','FOUR DISTINCT REFLECTIONS',['M1: east → northeast · surface −22.5°.','M2: north → northwest · surface 67.5°.','M3: west → northwest · surface 22.5°.','M4: south → southwest · surface 112.5°.','Gold = angled leaf; pale dashed = rest.'],y,'cyan')
y=p.card('04','PROTECTED TORCHES / SHARED REWARD',['T1–T4 sit behind solid perimeter walls.','Narrow spell ports block player passage.','Only a paired mirror-reflected shot ignites.','Fourth torch raises ENTIRE center + bridge.','Before then: water only; no center landing.'],y,'cyan')
p.footer(['Sieg enters through spikes on the EAST perimeter. The SOUTH perimeter is walled off; Coco uses pond pads.','Work clockwise: angle M1 → light T1 → reset M1, then repeat at M2, M3 and M4 with new shot directions.','Fourth torch raises the center platform, its chest and connecting bridge together; mirror resets clear Sieg’s lane.'],'Retry: lit torches latch. Spike failure returns Sieg to the east dock. No southern entrance or return shortcut.');p.save()
# GRIFFIN
p=Plan('04-griffin-enclosure','THE BALD GODDESS · GRIFFIN ENCLOSURE','North branch · northern-third lake, defended nest and four-pillar combat arena · 40 × 36 tiles',40,36)
p.tile(2,2,36,32,'#736a51','#c2a477');p.tile(2,2,36,10,C['water'],C['cyan'])
for r in [(0,0,40,2),(0,2,2,32),(38,2,2,32),(0,34,17,2),(23,34,17,2)]:p.tile(*r,'#334b36','#79936b')
p.tile(17,2,6,3,'#a38455',C['gold']);p.grid()
p.dot(20,3.5,1.1,'#a38455',C['gold']);p.label('NEST / START',20,6,C['gold'],13)
p.token('ITEM',20,3.5,'coco',.85);p.label('NORTH THIRD · WATER',9,4,C['cyan'],12)
p.label('SHORE / BLACK HOLE LANDING',20,12.8,C['cyan'],11)
for i,(x,y) in enumerate([(10,17),(30,17),(10,26),(30,26)],1):
 p.tile(x-1.1,y-1.1,2.2,2.2,'#535852','#d4d0ad');p.label('P'+str(i),x,y+.25,C['ink'],13)
p.label('FOUR LARGE RUINED PILLARS',20,19.8,C['muted'],12)
p.portal('S',20,34.5);p.label('TO SHRINE / RETREAT',20,32.5,C['cyan'],12)
p.token('C',18,30,'coco');p.token('S',23,30)
# Example airborne firing position and eye-beam lane.
p.token('G',28,7,'red',1);p.label('AIRBORNE LASER',31,5.2,C['red'],11)
p.route([(28,8.2),(24,25)],'red',True,3);p.token('S',24,25,'gold',.65)
p.route([(24,25),(20.5,25)],'gold');p.label('SLOW TIME → DODGE / RESCUE',20,23,C['coco'],11)
# Shore vortex: place within the existing 6-tile cast / 3-tile pull ranges.
p.token('G',20,10.5,'red',.7);p.dot(20,13,3,'none',C['coco'],extra='stroke-dasharray="6 4"')
p.token('BH',20,13,'coco',.65);p.token('C',20,16.5,'coco',.65)
p.route([(20,16),(20,13.5)],'coco');p.route([(20,10.5),(20,12.5)],'cyan',True)
p.label('PULL ASHORE',13.8,10,C['coco'],11)
# Headbutt lure: standing still draws a quick charge into a pillar.
p.token('G',30,21,'red',.75);p.token('S',30,29,'gold',.65)
p.route([(30,22),(30,24.8)],'red',True,4);p.route([(30,29),(33.5,29)],'gold')
p.label('HEADBUTT → P4 → STUN',30,31,C['red'],11)
p.dot(30,26,1.85,'none',C['gold'],extra='stroke-dasharray="5 4"')
# Flight to nest is safe only during a genuine opening; otherwise boss returns.
p.route([(18,29),(15,22),(15,13),(15,7),(18,4)],'coco',True)
p.label('FLIGHT TO NEST',9.5,8,C['coco'],11)
p.route([(27,7),(23,4.5)],'red',True);p.label('DEFEND NEST',31,10.5,C['red'],11)
p.chest(7,31,'WIG AFTER RESOLUTION')
y=190
y=p.card('01','LAKE + DEFENDED NORTHERN NEST',['Top third is water; nest at north-wall center.','Griffin starts there and flies over the lake.','It fires long-range laser beams from the air.','Coco flies to deliver optional collected items.','Nest approach triggers its defensive return.'],y)
y=p.card('02','BLACK HOLE → LAND COMBAT',['Coco places a vortex close to the shoreline.','Its pull draws the airborne Griffin onto land.','Respect 6-tile cast and 3-tile pull ranges.','Four ruined pillars provide collision targets.','Griffin remains vulnerable to normal attacks.'],y,'coco')
y=p.card('03','HEADBUTT → PILLAR COLLAPSE',['Sieg lingering in place provokes a headbutt.','The fast charge is difficult to dodge unaided.','Slow Time slows laser / charge progression.','Sieg can evade or move Coco out of danger.','Hit pillar → it falls on Griffin → brief stun.'],y,'cyan')
y=p.card('04','EXPLOIT THE STUN OPENING',['While stunned, attack OR fly to the nest.','Mirror distracts; shears then cut its hair.','Otherwise it returns to defend the approach.','No items: defeat it with combat + pillars.','Automatic cut → one wig; retain both tools.'],y,'cyan')
p.footer(['Coco pulls Griffin ashore → Sieg baits a headbutt → Slow Time enables a dodge behind a ruined pillar.','Pillar impact stuns Griffin: attack during recovery, or use the opening for Coco’s Flight / item delivery.','Optional nest route: deliver mirror → distraction → deliver shears → automatic haircut → one wig; no defeat needed.'],'Retry: restore pillars and boss state; retain quest items. Prevent chain-stuns; spent pillars must not make victory impossible.');p.save()
