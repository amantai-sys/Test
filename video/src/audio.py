# Music + SFX synthesis on the same event map as the picture, then mix with the VO.
import json, numpy as np, scipy.signal as ss, scipy.io.wavfile as wf
SR = 48000
E = json.load(open('../build/events.json')); TL = json.load(open('../build/timeline.json'))
TOT = E['total']; N = int(TOT * SR) + SR
BEAT = E['beat']; T0 = E['thumps'][0]
rng = np.random.default_rng(7)
music = np.zeros((N, 2)); sfx = np.zeros((N, 2))
def add(buf, t, x, gain=1.0, pan=0.0):
    i = int(t * SR); 
    if i >= N or i + len(x) < 0: return
    if i < 0: x = x[-i:]; i = 0
    x = x[:N - i]; l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    buf[i:i + len(x), 0] += x * gain * l * 1.414; buf[i:i + len(x), 1] += x * gain * r * 1.414
def tt(d): return np.arange(int(d * SR)) / SR
def env(d, a=0.005, r=0.1, s=None):
    t = tt(d); e = np.minimum(1, t / max(a, 1e-4)); rel = np.clip((d - t) / r, 0, 1); return e * rel
def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def lp(x, f, o=2): b, a = ss.butter(o, min(f / (SR / 2), 0.99)); return ss.lfilter(b, a, x)
def hp(x, f, o=2): b, a = ss.butter(o, f / (SR / 2), 'high'); return ss.lfilter(b, a, x)
def bp(x, f1, f2, o=2): b, a = ss.butter(o, [f1 / (SR / 2), min(f2 / (SR / 2), 0.99)], 'band'); return ss.lfilter(b, a, x)
noise = lambda d: rng.standard_normal(int(d * SR))
# ---------- instruments ----------
def fife(m, d, vib=1.0):
    t = tt(d); f = mtof(m) * (1 + 0.004 * vib * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t * 4))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph) + 0.03 * noise(d) * np.exp(-t * 30)
    return x * env(d, 0.015, 0.06) * 0.3
def glock(m, d=0.8):
    t = tt(d); f = mtof(m); return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 9)) * np.exp(-t * 5) * 0.25
def tuba(m, d, bend=0.0):
    t = tt(d); f = mtof(m) * (1 + bend * t / d)
    ph = 2 * np.pi * np.cumsum(f) / SR; x = ss.sawtooth(ph) * 0.6 + np.sin(ph)
    return lp(x, 380 + 900 * np.exp(-t * 0)[0], 2) * env(d, 0.02, 0.08) * 0.45
def snare(d=0.18, g=1.0):
    t = tt(d); x = bp(noise(d), 1500, 9000) * np.exp(-t * 28) * 0.6 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 35) * 0.5
    return x * g * 0.5
def kick(d=0.35, g=1.0, f0=110, f1=42):
    t = tt(d); f = f1 + (f0 - f1) * np.exp(-t * 25); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * g
def cymbal(d=1.5, g=0.4):
    t = tt(d); return hp(noise(d), 5000) * np.exp(-t * 3) * g
def pluck(m, d=0.6, damp=0.996, bright=0.5):
    f = mtof(m); L = int(SR / f); buf = rng.uniform(-1, 1, L); buf = lp(buf, 800 + 6000 * bright, 1)
    out = np.zeros(int(d * SR))
    for i in range(len(out)):
        out[i] = buf[i % L]; buf[i % L] = damp * 0.5 * (buf[i % L] + buf[(i + 1) % L])
    return out * 0.6
def marimba(m, d=0.5):
    t = tt(d); f = mtof(m); return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 30)) * np.exp(-t * 9) * 0.35
def pad(ms, d, g=0.15, trem=0.0, rise=0.0):
    t = tt(d); x = np.zeros_like(t)
    for m in ms:
        for det in (-0.08, 0.08):
            f = mtof(m + det) * (1 + rise * t / d); x += ss.sawtooth(2 * np.pi * np.cumsum(f) / SR)
    x = lp(x, 1600, 2) * env(d, 0.4, 0.3)
    if trem: x *= 0.7 + 0.3 * np.sin(2 * np.pi * trem * t)
    return x * g / len(ms)
# ---------- march score (8 bars of 2/4 in eighths) ----------
MEL = [67,0,72,72, 76,76,74,72, 67,0,71,71, 74,74,72,71, 67,0,72,72, 76,76,79,79, 77,76,74,71, 72,0,72,0]
CH = [48,48,43,43,48,48,43,48]  # bass roots per bar
def grid(t): return T0 + np.ceil((t - T0) / BEAT - 1e-6) * BEAT
def march(t0, t1, g=1.0, mel=True, fife_g=1.0, heavy=False, detune=0.0, bright=False):
    t = grid(t0); k = int(round((t - T0) / BEAT)) % 16
    while t < t1 - 1e-6:
        bar = (k // 2) % 8
        root = CH[bar]; add(music, t, tuba(root - 12 + (7 if k % 2 else 0), BEAT * 0.5), g * 0.8)
        if k % 2 == 0: add(music, t, kick(g=0.9 if heavy else 0.55), g)
        for e in range(2):
            te = t + e * BEAT / 2
            if te >= t1: break
            if e == 0 or (k + e) % 2: add(music, te, snare(g=0.8 if e == 0 else 0.45), g * 0.7, 0.2)
            n = MEL[(k * 2 + e) % 32]
            if mel and n:
                nn = n + (rng.uniform(-1, 1) * detune)
                add(music, te, fife(nn, BEAT / 2 * 0.9), g * fife_g, -0.25)
                if bright: add(music, te, glock(n + 12), g * 0.5, 0.3)
        if heavy and k % 2 == 0: add(music, t, tuba(root - 12, BEAT * 0.9), g * 0.7)
        t += BEAT; k = (k + 1) % 16
P = TL['phrases']; sc = dict(E['scenes'])
nxt = lambda name: [s[1] for s in E['scenes']][[s[0] for s in E['scenes']].index(name) + 1]
# A: drunk intro
t = 0.05
while t < sc['parade'] - 0.1:
    add(music, t, tuba(rng.choice([36, 38, 41, 43]), 0.3, bend=rng.uniform(-0.15, 0.1)), 0.7); t += rng.uniform(0.32, 0.5)
add(music, 0.0, snare(0.6) * np.linspace(1, 0, int(0.6 * SR)), 0.4)
# B: proud march
march(sc['parade'], E['breakstep'] - 0.05, 0.75)
# stop-hit on "Break step!"
add(music, E['breakstep'], kick(0.6, 1.4), 1.0); add(music, E['breakstep'], cymbal(1.6, 0.5), 1); add(music, E['breakstep'], tuba(31, 0.5), 1.0)
# C: confused ducks (wonky march)
march(sc['bridge'] + 0.3, sc['rival'] - 0.1, 0.55, detune=0.6, fife_g=0.8)
# D: rival smug (bass + snare only)
march(sc['rival'] + 0.3, sc['weird'] - 0.05, 0.6, mel=False)
# E: sting
add(music, E['weird'], pad([36, 37, 42], 0.8, 0.5), 1); add(music, E['weird'], kick(0.5, 1.0), 0.8)
# F: tiptoe pizzicato
scale = [60, 63, 65, 67, 68, 67, 65, 63]; t = sc['tiptoe'] + 0.1; i = 0
while t < sc['march'] - 0.1:
    add(music, t, pluck(scale[i % 8], 0.3, 0.99, 0.3), 0.7, (i % 2) * 0.4 - 0.2); t += BEAT / 2; i += 1
# G: heavy march
march(sc['march'], sc['thump'] - 0.05, 0.95, heavy=True)
# H: THUMPs (music+sfx)
for i, th in enumerate(E['thumps']):
    add(sfx, th, kick(1.2, 1.6 + i * 0.3, 90, 32), 1.0); add(sfx, th, lp(noise(0.5), 300) * np.exp(-tt(0.5) * 8) * 0.8, 1); add(music, th, tuba(24 + i, 0.9), 0.9)
# I: tension
d = E['what'] - sc['hum']
add(music, sc['hum'], pad([36, 37, 43], d, 0.55, trem=6, rise=0.25), 1)
t = grid(sc['hum'])
while t < E['what'] - 0.05: add(music, t, kick(0.25, 0.7), 1); add(music, t, snare(0.1, 0.4), 0.6); t += BEAT
# K: explanation groove (marimba arpeggios)
arp = [60, 64, 67, 72, 67, 64, 62, 65, 69, 74, 69, 65]; t = grid(sc['string']); i = 0
while t < sc['pushes'] - 0.05:
    add(music, t, marimba(arp[i % 12]), 0.9, 0.3 * np.sin(i)); add(music, t, hp(noise(0.05), 6000) * np.exp(-tt(0.05) * 60) * 0.3, 0.6, 0.4)
    if i % 2 == 0: add(music, t, tuba(36 + (0 if (i // 6) % 2 == 0 else 2), BEAT * 0.8), 0.6)
    t += BEAT / 2; i += 1
# pushes: tension march returns
march(sc['pushes'], E['snap'] - 0.1, 0.8, heavy=True, detune=0.0)
add(music, sc['pushes'], pad([36, 42, 43], E['snap'] - sc['pushes'], 0.4, trem=8, rise=0.3), 1)
# M: sad trombone slide while they slide
for j, (m, d) in enumerate([(58, 0.32), (57, 0.32), (56, 0.32), (55, 1.0)]):
    t0 = 55.95 + j * 0.34; tm = tt(d); f = mtof(m) * (1 - (0.06 * tm / d if j == 3 else 0)) * (1 + (0.012 * np.sin(2 * np.pi * 6 * tm) if j == 3 else 0))
    x = lp(ss.sawtooth(2 * np.pi * np.cumsum(f) / SR), 1200) * env(d, 0.03, 0.12) * 0.35; add(music, t0, x, 1)
# N: bright reprise
march(sc['rules'], sc['fire'] - 0.05, 0.75, bright=True)
add(music, E['stamp'], kick(0.4, 1.0), 1)
# O: night lullaby version of the melody on plucks (hard cut at the end)
t = grid(sc['fire']); k = 0
while t < TOT:
    for e in range(2):
        n = MEL[(k * 2 + e) % 32]
        if n: add(music, t + e * BEAT / 2, glock(n, 0.6), 0.55, -0.2)
    if k % 2 == 0: add(music, t, pluck(CH[(k // 2) % 8] - 12, 0.8, 0.995, 0.2), 0.8)
    t += BEAT; k += 1
# ---------- SFX ----------
def whoosh(d=0.35, up=True):
    t = tt(d); x = noise(d); f = np.linspace(400, 3000, len(t)) if up else np.linspace(3000, 400, len(t))
    y = np.zeros_like(x); 
    for i in range(0, len(x), 512): seg = x[i:i + 512]; y[i:i + 512] = bp(seg, f[i] * 0.6, f[i] * 1.6, 1)
    return lp(x, 2500) * np.sin(np.pi * t / d) ** 2 * 0.5
def thud(g=1.0, wood=False):
    t = tt(0.3); x = kick(0.3, 1, 140, 55) * 0.7 + lp(noise(0.3), 900) * np.exp(-t * 30) * 0.6
    if wood: x += np.sin(2 * np.pi * 320 * t) * np.exp(-t * 40) * 0.4
    return x * g
def creak(d=0.8, f0=180, g=0.4):
    t = tt(d); f = f0 * (1 + 0.3 * np.sin(2 * np.pi * 1.3 * t)); ph = 2 * np.pi * np.cumsum(f) / SR
    pulses = (np.sin(ph) > 0.97).astype(float); return bp(pulses + noise(d) * 0.05, 300, 3000) * np.sin(np.pi * t / d) * g * 3
def quack():
    t = tt(0.28); f = 520 * (1 - 0.25 * t / 0.28); x = ss.sawtooth(2 * np.pi * np.cumsum(f) / SR)
    return (bp(x, 900, 1300) + 0.6 * bp(x, 2400, 2900)) * env(0.28, 0.01, 0.08) * 1.2
def ping():
    t = tt(1.2); return sum(np.sin(2 * np.pi * f * t) * np.exp(-t * dd) for f, dd in [(2400, 4), (3900, 6), (6100, 9)]) * 0.3
def splash1():
    t = tt(0.7); return bp(noise(0.7), 300, 6000) * np.exp(-t * 6) * (1 - np.exp(-t * 200)) * 0.8
def scratch():
    t = tt(0.4); f = 300 + 900 * np.abs(np.sin(2 * np.pi * 3.5 * t)); return bp(noise(0.4), 200, 4000) * 0.5 + 0.3 * ss.sawtooth(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3)
# stumbling feet
for (a, b) in [(0.1, sc['parade'] - 0.1), (sc['ducks'], sc['rival'])]:
    t = a
    while t < b: add(sfx, t, thud(0.25, True), 1, rng.uniform(-0.6, 0.6)); t += rng.uniform(0.15, 0.4)
add(sfx, 1.4 + 0.15, np.sin(2 * np.pi * 700 * tt(0.25)) * np.exp(-tt(0.25) * 18) * 0.5, 1)  # bonk
# parade footsteps on beat
t = grid(sc['parade'])
while t < sc['boots']: add(sfx, t, thud(0.35), 1); t += BEAT
for x in E['left']: add(sfx, x, thud(1.3), 1); add(sfx, x - 0.3, whoosh(0.3), 0.4)
add(sfx, E['allboots'], thud(1.8), 1); add(sfx, E['allboots'] - BEAT, thud(1.0), 1); add(sfx, E['allboots'] - 2 * BEAT, thud(1.0), 1)
for i in range(3): add(sfx, sc['general'] + 0.2 + i * 0.3, glock(96 + i * 3, 0.5), 0.6, 0.5)  # medal glints
add(sfx, nxt('break') - 0.25, whoosh(0.3), 0.7)
for i in range(5): add(sfx, sc['bridge'] + 0.3 + i * 0.32, glock(91 + (i % 3) * 4, 0.5), 0.5, rng.uniform(-0.6, 0.6))
add(sfx, E['quack'][1], quack(), 1.0, 0.3); add(sfx, E['quack'][1] + 0.3, quack(), 0.7, 0.3)
add(sfx, E['whip'], whoosh(0.32), 1.1); add(sfx, E['quote'] - 0.05, whoosh(0.2), 0.6); add(sfx, E['quote'] + 0.1, thud(0.6), 1)
t = grid(TL['phrases'][15]['start'])
while t < sc['thump']: add(sfx, t, thud(0.5, True), 1); t += BEAT
add(sfx, sc['hum'], np.sin(2 * np.pi * 55 * tt(3.0)) * (np.sin(2 * np.pi * 57 * tt(3.0)) * 0.5 + 0.5) * np.sin(np.pi * tt(3.0) / 3.0) * 0.5, 1)
for w in E['wobble']: add(sfx, w, creak(0.9, 160), 1, -0.3)
add(sfx, E['what'] - 0.42, scratch(), 0.8)
add(sfx, E['pluck'], pluck(40, 2.5, 0.9985, 0.7), 1.3)
for p in E['pushes']: add(sfx, p, whoosh(0.3), 0.6)
t0 = E['pushes'][-1]; d = 0.7; f = np.linspace(800, 2400, int(d * SR)); add(sfx, t0, np.sin(2 * np.pi * np.cumsum(f) / SR) * env(d, 0.02, 0.2) * 0.25, 1)  # whistle up
t = grid(sc['pushes'])
while t < E['snap'] - 0.1: add(sfx, t, thud(0.6, True), 1); t += BEAT
add(sfx, sc['pushes'] + 0.5, creak(3.0, 140, 0.6), 1)
add(sfx, E['snap'] - 0.25, creak(0.25, 260), 1); add(sfx, E['snap'], ping(), 1.0, 0.4); add(sfx, E['snap'], hp(noise(0.08), 2000) * 1.2, 1)
add(sfx, E['tilt'] - 0.2, creak(1.2, 110, 0.9), 1); add(sfx, E['tilt'], kick(1.0, 1.4, 70, 30), 1); add(sfx, E['tilt'], lp(noise(1.2), 1200) * np.exp(-tt(1.2) * 3) * 0.8, 1)
slide0 = [w for w in TL['words'] if w['p'] == 26 and w['w'] == 'slide'][0]['s'] - 0.6
for i in range(6): add(sfx, slide0 + 0.75 + i * 0.22, splash1(), 0.9, rng.uniform(-0.5, 0.5))
t = E['still']
while t < sc['rules']: add(sfx, t, np.sin(2 * np.pi * np.cumsum(np.linspace(300, 900, int(0.08 * SR))) / SR) * np.exp(-tt(0.08) * 20) * 0.25, 1, rng.uniform(-0.5, 0.5)); t += BEAT / 2
add(sfx, E['stamp'], thud(1.5), 1)
t = sc['fire']
while t < TOT: add(sfx, t, hp(noise(0.02), 2000) * np.exp(-tt(0.02) * 200) * rng.uniform(0.2, 0.6), 1, rng.uniform(-0.4, 0.4)); t += rng.exponential(0.07)
add(sfx, sc['fire'], lp(noise(TOT - sc['fire']), 500) * 0.06, 1)
# ---------- mix ----------
sr0, vo = wf.read('../build/vo.wav'); vo = vo.astype(np.float32) / 32768; v = np.zeros(N); v[:len(vo)] = vo[:N]
venv = np.convolve(np.abs(v), np.ones(4800) / 4800, mode='same'); duck = 1 - 0.55 * np.clip(venv / 0.04, 0, 1)
duck = np.convolve(duck, np.ones(2400) / 2400, mode='same')
music *= 0.32 * duck[:, None]; sfx *= 0.42
mix = music + sfx + v[:, None] * 0.95
mix = mix[:int(TOT * SR)]
mix /= max(1e-9, np.max(np.abs(mix))) / 0.95
fade = int(0.008 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]  # click-free hard cut
for name, b in [('mix', mix), ('music', music[:len(mix)] / 0.32), ('sfx', sfx[:len(mix)])]:
    b = b / max(1e-9, np.max(np.abs(b))) * 0.95 if name != 'mix' else b
    wf.write(f'../build/{name}.wav', SR, (b * 32767).astype(np.int16))
print('ok', len(mix) / SR)
