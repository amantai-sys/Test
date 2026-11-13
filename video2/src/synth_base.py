# Music + SFX synthesis on the same event map as the picture, then mix with the VO.
import json, numpy as np, scipy.signal as ss, scipy.io.wavfile as wf
SR = 48000
E = json.load(open('../build/events.json')); TL = json.load(open('../build/timeline.json'))
TOT = E['total']; N = int(TOT * SR) + SR
BEAT = E['beat']; T0 = E['pssh'][0]
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
