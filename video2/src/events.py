# Sync points shared by picture and sound: build/events.json
import json, re
d = json.load(open('build/timeline.json')); P = d['phrases']; W = d['words']
def word(pi, text, n=0):
    c = [w for w in W if w['p'] == pi and re.sub(r'\W', '', w['w']).lower() == text.lower()]
    return c[n]['s']
BEAT = 0.5
order, sc = [], {}
for p in P:
    if p['scene'] not in sc: sc[p['scene']] = 0.0 if p['i'] == 0 else p['start'] - 0.06; order.append(p['scene'])
ps0 = P[10]['start']
ev = dict(
  total=round(d['total'] + 0.02, 3), beat=BEAT,
  scenes=[[k, round(sc[k], 3)] for k in order],
  sand=[0.45 + k * 0.5 for k in range(6)],
  jet=word(1, 'jet'),
  hotel=word(2, 'hotel'),
  chokes=word(3, 'chokes'),
  quote=P[4]['start'],
  weird=P[5]['start'],
  rips=[word(6, 'tears'), word(6, 'again', 0), word(6, 'again', 1)],
  claps=word(7, 'claps'),
  lower=word(8, 'lower'),
  updown=[word(9, 'up'), word(9, 'down')],
  pssh=[round(ps0 + 0.2 + k * BEAT, 3) for k in range(3)],
  hairline=word(11, 'hairline'), corner=word(11, 'corner'),
  what=P[12]['start'],
  climbs=word(13, 'climbs'), flow=word(13, 'flow'),
  holds=word(14, 'holds'), rips2=word(14, 'rips'),
  races=word(15, 'races'), bursts=word(15, 'bursts'), blasts=word(15, 'blasts'),
  round2=P[16]['start'], seat=P[17]['start'],
)
json.dump(ev, open('build/events.json', 'w'), indent=1); print(json.dumps(ev))
