# Single source of sync points for visuals and audio: build/events.json from build/timeline.json
import json, re
d = json.load(open('build/timeline.json'))
P = d['phrases']; W = d['words']
def ph(i): return P[i]
def word(pi, text, n=0):
    c = [w for w in W if w['p'] == pi and re.sub(r'\W', '', w['w']).lower() == text.lower()]
    return c[n]['s']
BEAT = 0.6  # 100 BPM march
sc = {}  # scene start times
order = []
for p in P:
    if p['scene'] not in sc:
        sc[p['scene']] = p['start'] - 0.06 if p['i'] else 0.0; order.append(p['scene'])
sc['open'] = 0.0
th0 = P[16]['start']
ev = dict(
  total=round(d['total'] + 0.02, 3),
  beat=BEAT,
  scenes=[[k, round(sc[k], 3)] for k in order],
  left=[word(3, 'left', 0), word(3, 'right'), word(3, 'left', 1)],
  allboots=word(4, 'same'),
  breakstep=word(6, 'Break'),
  quack=[word(8, 'confused'), word(8, 'ducks')],
  whip=P[9]['start'] - 0.12,
  quote=P[10]['start'],
  weird=P[11]['start'],
  thumps=[round(th0 + 0.15 + k * BEAT, 3) for k in range(3)],
  hum=P[17]['start'],
  wobble=[word(18, 'tiny'), word(18, 'bigger')],
  what=P[20]['start'],
  pluck=word(21, 'guitar'),
  pushes=[word(23, 'Little'), word(23, 'just'), word(23, 'higher', 0), word(23, 'higher', 1)],
  snap=word(25, 'snaps'), tilt=word(25, 'tilts'),
  river=word(26, 'river'), still=P[27]['start'],
  stamp=word(28, 'rules'),
  fire=P[29]['start'],
)
json.dump(ev, open('build/events.json', 'w'), indent=1)
print(json.dumps(ev))
