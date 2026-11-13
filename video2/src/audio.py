# Swing score + SFX for "Why Airplane Windows Are Round", driven by build/events.json.
exec(open('synth_base.py').read())
def trumpet(m, d, g=1.0):
    t = tt(d); f = mtof(m) * (1 + 0.006 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t * 3)); ph = 2 * np.pi * np.cumsum(f) / SR
    x = ss.sawtooth(ph) * 0.6 + np.sin(ph); x = bp(x, 500, 3200); return x * env(d, 0.02, 0.07) * 0.4 * g
def vibe(m, d=0.9):
    t = tt(d); f = mtof(m); return (np.sin(2 * np.pi * f * t) + 0.2 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 12)) * np.exp(-t * 2.8) * (0.8 + 0.2 * np.sin(2 * np.pi * 5.5 * t)) * 0.22
def brush(d=0.25, g=1.0): t = tt(d); return bp(noise(d), 2500, 9000) * np.exp(-t * 14) * 0.25 * g
def ride(g=1.0): t = tt(0.6); return (hp(noise(0.6), 6000) * 0.3 + np.sin(2 * np.pi * 5200 * t) * 0.08) * np.exp(-t * 7) * g
CH = [[53, 57, 60, 62], [50, 54, 57, 60], [55, 58, 62, 65], [48, 52, 55, 58]]   # F6 D7 Gm7 C7
BASS = [[41, 45, 48, 50], [38, 42, 45, 48], [43, 46, 50, 46], [36, 40, 43, 46]]
MEL = [(0, 72, 0.6), (0.67, 69, 0.3), (1, 72, 0.6), (2, 74, 0.9), (3.67, 72, 0.3), (4, 70, 0.6), (5, 69, 0.6), (6, 67, 1.4), (8, 72, 0.6), (8.67, 74, 0.3), (9, 77, 0.6), (10, 74, 0.9), (11.67, 72, 0.3), (12, 70, 0.6), (12.67, 69, 0.3), (13, 67, 0.6), (14, 65, 1.6)]
def grid(t): return T0 + np.ceil((t - T0) / BEAT - 1e-6) * BEAT
def swing(t0, t1, g=1.0, mel=True, bass=True, drums=True, comp=True, brass=False, bright=0.0):
    t = grid(t0); k = int(round((t - T0) / BEAT)) % 16
    while t < t1 - 1e-6:
        bar = (k // 4) % 4
        if bass: add(music, t, pluck(BASS[bar][k % 4] - 12, 0.5, 0.993, 0.35), g * 0.9)
        if drums:
            add(music, t, ride(), g * 0.5, 0.3)
            if k % 2: add(music, t, brush(), g, -0.2)
            add(music, t + BEAT * 0.67, ride(0.6), g * 0.4, 0.3)
        if comp and k % 4 in (1, 3):
            for n in CH[bar]: add(music, t + BEAT * 0.67, vibe(n, 0.5), g * 0.6, 0.2)
        if brass and k % 4 == 0:
            for n in CH[bar]: add(music, t, trumpet(n, 0.4, 0.5), g * 0.7, -0.1)
        if mel:
            for (b, n, dd) in MEL:
                if int(b) == k: add(music, t + (b - int(b)) * BEAT, trumpet(n + (12 if bright else 0), dd * BEAT), g * 0.9, -0.25)
        t += BEAT; k = (k + 1) % 16
sc = dict(E['scenes']); nxt = lambda n: [s[1] for s in E['scenes']][[s[0] for s in E['scenes']].index(n) + 1]
# --- score
swing(0.0, sc['year'], 0.7, mel=False, comp=False)
swing(sc['year'], E['quote'] - 0.05, 0.8)
for n in [53, 57, 60, 65]: add(music, E['quote'], trumpet(n, 0.35), 0.9)                     # stop-time hit
swing(E['quote'] + 0.5, sc['weird'], 0.5, mel=False, comp=False)
add(music, E['weird'], pad([41, 42, 47], 0.8, 0.45), 1); add(music, E['weird'], kick(0.5, 1.0), 0.7)
t = grid(sc['paper']); i = 0                                                                  # night: vibes + bass
while t < sc['rollout'] - 0.05:
    bar = (i // 4) % 4; add(music, t, pluck(BASS[bar][i % 4] - 12, 0.5, 0.993, 0.25), 0.7)
    if i % 4 == 0: [add(music, t, vibe(n, 1.6), 0.7, 0.2) for n in CH[bar]]
    t += BEAT; i += 1
swing(sc['rollout'], sc['tank'] - 0.05, 0.95, brass=True, bright=1)
add(music, sc['tank'], pad([29, 36, 37], sc['pump'] - sc['tank'] + 0.3, 0.45, trem=0, rise=0.05), 1)
t = sc['pump'] + 0.3; i = 0                                                                     # pump pulse
while t < E['pssh'][0] - 0.2: add(music, t, tuba(29 + (i % 2) * 5, 0.4), 0.8); add(music, t, kick(0.3, 0.7), 0.8); t += 0.45; i += 1
add(music, sc['pump'], pad([41, 48], E['pssh'][0] - sc['pump'], 0.25, trem=4), 1)
for p in E['pssh']: add(music, p, tuba(29, 0.45), 1.0); add(music, p, kick(0.6, 1.3), 1.0)
add(music, sc['crack'], pad([77, 78, 84], E['what'] - sc['crack'], 0.3, trem=9, rise=0.1), 1)
arp = [65, 69, 72, 77, 72, 69, 67, 70, 74, 79, 74, 70]; t = grid(sc['flow']); i = 0          # explanation groove
while t < E['races'] - 0.1:
    add(music, t, marimba(arp[i % 12]), 0.85, 0.3 * np.sin(i)); add(music, t, hp(noise(0.05), 6000) * np.exp(-tt(0.05) * 60) * 0.3, 0.6, 0.4)
    if i % 2 == 0: add(music, t, pluck(BASS[(i // 8) % 4][(i // 2) % 4] - 12, 0.5, 0.993, 0.3), 0.8)
    t += BEAT / 2; i += 1
t = E['races']                                                                                   # drum roll to the burst
while t < E['bursts']: add(music, t, snare(0.12, 0.3 + 0.7 * (t - E['races']) / (E['bursts'] - E['races'])), 0.9); t += 0.06
add(music, E['bursts'], kick(1.0, 1.6, 80, 30), 1); add(music, E['bursts'], cymbal(2.0, 0.6), 1)
swing(sc['round2'], sc['seat'] - 0.05, 0.95, brass=True, bright=1)
t = grid(sc['seat']); i = 0                                                                       # cabin muzak, hard cut
while t < TOT: bar = (i // 4) % 4; add(music, t, vibe(CH[bar][i % 4] + 12, 0.7), 0.55, -0.2); (i % 2 == 0) and add(music, t, pluck(BASS[bar][i % 4] - 12, 0.5, 0.993, 0.2), 0.6); t += BEAT; i += 1
# --- SFX
def whoosh(d=0.35): t = tt(d); return lp(noise(d), 2500) * np.sin(np.pi * t / d) ** 2 * 0.5
def scrape(d=0.4): t = tt(d); return bp(noise(d), 1500, 6000) * np.sin(np.pi * t / d) * 0.35
def rip(d=0.35): t = tt(d); x = bp(noise(d), 800, 7000) * (0.5 + 0.5 * (rng.uniform(0, 1, len(t)) > 0.7)); return x * np.sin(np.pi * t / d) ** 0.5 * 0.6
def hiss(d=0.45, g=1.0): t = tt(d); return bp(noise(d), 2000, 9000) * np.exp(-t * 4) * (1 - np.exp(-t * 60)) * 0.6 * g
def clank(): t = tt(0.6); return (sum(np.sin(2 * np.pi * f * t) * np.exp(-t * dd) for f, dd in [(420, 6), (1130, 9), (2210, 14)]) * 0.25 + lp(noise(0.6), 2000) * np.exp(-t * 30) * 0.4)
def creak(d=0.8, f0=180, g=0.4): t = tt(d); f = f0 * (1 + 0.3 * np.sin(2 * np.pi * 1.3 * t)); ph = 2 * np.pi * np.cumsum(f) / SR; pul = (np.sin(ph) > 0.97).astype(float); return bp(pul + noise(d) * 0.05, 300, 3000) * np.sin(np.pi * t / d) * g * 3
def splash(d=1.2, g=1.0): t = tt(d); return bp(noise(d), 200, 7000) * np.exp(-t * 3) * (1 - np.exp(-t * 80)) * 0.8 * g
def scratch(): t = tt(0.4); f = 300 + 900 * np.abs(np.sin(2 * np.pi * 3.5 * t)); return bp(noise(0.4), 200, 4000) * 0.5 + 0.3 * ss.sawtooth(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3)
def ding(): t = tt(1.6); return (np.sin(2 * np.pi * 988 * t) * np.exp(-t * 2.5) + np.sin(2 * np.pi * 784 * t) * np.exp(-(t - 0.35).clip(0) * 2.5) * (t > 0.35)) * 0.3
for s in E['sand']: add(sfx, s, scrape(0.42), 0.8, 0.2)
d = 3.0; t = tt(d); fly = lp(noise(d), 1200) * np.exp(-((t - 1.3) / 0.6) ** 2) * 1.2 + np.sin(2 * np.pi * np.cumsum(200 - 60 * t) / SR) * np.exp(-((t - 1.3) / 0.7) ** 2) * 0.3
add(sfx, E['jet'] - 1.3, fly, 1.0)
add(sfx, E['hotel'], np.sin(2 * np.pi * 120 * tt(0.5)) * 0.15 * np.exp(-tt(0.5) * 2) + hp(noise(0.5), 3000) * 0.05, 1)
add(sfx, E['chokes'] + 0.2, whoosh(0.35), 0.9); add(sfx, E['chokes'] + 0.35, bp(noise(0.3), 400, 5000) * np.exp(-tt(0.3) * 10) * 0.9, 1)
add(sfx, E['quote'] - 0.05, whoosh(0.3), 0.6); add(sfx, sc['weird'], whoosh(0.4), 0.7)
for r in E['rips']: add(sfx, r, rip(), 1.0, rng.uniform(-0.3, 0.3))
for i in range(60): add(sfx, E['claps'] + 0.4 + rng.uniform(0, 1.3), hp(noise(0.04), 900) * np.exp(-tt(0.04) * 90) * 0.5, 0.8, rng.uniform(-0.8, 0.8))
for i in range(4): add(sfx, E['claps'] - 0.6 + i * 0.37, hp(noise(0.03), 4000) * 0.6, 1, 0.4)
add(sfx, E['lower'] + 0.35, clank(), 0.8); add(sfx, E['lower'] + 1.8, splash(1.0, 0.7), 1)
t = E['lower'] + 0.5
while t < E['lower'] + 1.8: add(sfx, t, clank() * 0.15, 1, 0.3); t += 0.18
t = sc['pump'] + 0.3; i = 0
while t < E['pssh'][0] - 0.2: add(sfx, t, hiss(0.4, 0.5), 1, (i % 2) * 0.6 - 0.3); t += 0.45; i += 1
for p in E['pssh']: add(sfx, p, hiss(0.5, 1.6), 1)
for i in range(10): add(sfx, E['hairline'] - 0.2 + i * 0.22, creak(0.12, 900, 0.5), 1, 0.3)
add(sfx, E['what'] - 0.42, scratch(), 0.8)
add(sfx, E['climbs'], whoosh(0.6), 0.6)
add(sfx, E['holds'] - 0.9, creak(0.6, 240, 0.35), 1); add(sfx, E['rips2'], rip(0.45), 1.3)
for i in range(16): add(sfx, E['races'] + i * 0.1, creak(0.1, 600 + i * 40, 0.6), 1, 0.4)
add(sfx, E['bursts'], hp(noise(0.12), 1500) * 1.2, 1); add(sfx, E['bursts'] + 0.3, splash(1.6, 0.9), 1)
add(sfx, E['blasts'] + 0.15, whoosh(0.4), 0.8); add(sfx, E['blasts'] + 0.45, splash(1.6, 1.4), 1, -0.2)
d = 2.0; t = tt(d); add(sfx, sc['round2'], lp(noise(d), 1500) * np.sin(np.pi * t / d) * 1.0, 1)
add(sfx, sc['seat'] + 0.25, ding(), 1); add(sfx, sc['seat'], lp(noise(TOT - sc['seat']), 300) * 0.12, 1)
# --- mix (same ducking as the first film)
sr0, vo = wf.read('../build/vo.wav'); vo = vo.astype(np.float32) / 32768; v = np.zeros(N); v[:len(vo)] = vo[:N]
venv = np.convolve(np.abs(v), np.ones(4800) / 4800, mode='same'); duck = np.convolve(1 - 0.55 * np.clip(venv / 0.04, 0, 1), np.ones(2400) / 2400, mode='same')
music *= 0.32 * duck[:, None]; sfx *= 0.42
mix = (music + sfx + v[:, None] * 0.95)[:int(TOT * SR)]; mix /= max(1e-9, np.max(np.abs(mix))) / 0.95
fade = int(0.008 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
wf.write('../build/mix.wav', SR, (mix * 32767).astype(np.int16)); print('ok', len(mix) / SR)
