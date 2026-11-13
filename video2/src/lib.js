// Shared helpers: math, easing, noise, textures, camera, characters, props.
const W = 1080, H = 1920, ZK = 1.32;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, x) => clamp((x - a) / (b - a));
const sstep = (a, b, x) => { const t = inv(a, b, x); return t * t * (3 - 2 * t); };
const easeIO = t => -(Math.cos(Math.PI * clamp(t)) - 1) / 2;
const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
const easeIn = t => Math.pow(clamp(t), 3);
const easeBack = t => { t = clamp(t); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const noise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(rnd(i), rnd(i + 1), u) * 2 - 1; };
// spring-like decaying wobble after an impulse at time t0
const kick = (t, t0, freq = 18, decay = 7) => t < t0 ? 0 : Math.sin((t - t0) * freq) * Math.exp(-(t - t0) * decay);
const pulse = (t, t0, a = 0.04, r = 0.25) => t < t0 - a ? 0 : t < t0 ? (t - t0 + a) / a : Math.exp(-(t - t0) / r);

// ---------- textures ----------
let PAPER, GRAIN, BRUSH;
function makeTextures() {
  const mk = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); return c; };
  BRUSH = mk(512, 512, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const x = rnd(i) * w, y = rnd(i + 999) * h, l = 10 + rnd(i + 5) * 40, a = (rnd(i + 7) - 0.5) * 0.8;
      const v = Math.floor(90 + rnd(i + 3) * 80);
      g.strokeStyle = `rgba(${v},${v},${v},0.35)`; g.lineWidth = 3 + rnd(i + 11) * 7; g.lineCap = 'round';
      for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
        g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l); g.stroke();
      }
    }
  });
  GRAIN = mk(512, 512, (g, w, h) => {
    const im = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = (Math.random() * 255) | 0; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
  });
}
// overlay painterly brush texture inside current path (call after fill)
function paint(ctx, alpha = 0.22, scale = 1) {
  ctx.save(); ctx.clip();
  const p = ctx.createPattern(BRUSH, 'repeat'); p.setTransform(new DOMMatrix().scale(scale));
  ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = alpha; ctx.fillStyle = p;
  ctx.fillRect(-1e4, -1e4, 2e4, 2e4); ctx.restore();
}

// ---------- camera ----------
// c = {x, y, z, r, sx, sy}; p = parallax depth (1 = subject plane)
function cam(ctx, c, p = 1) {
  const k = ctx._pre || 1; ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.translate(W / 2 + (c.sx || 0) * p, H / 2 + (c.sy || 0) * p);
  ctx.rotate(c.r || 0);
  const z = Math.pow(c.z * (c.raw ? 1 : ZK), p);
  ctx.scale(z, z);
  ctx.translate(-c.x * p, -c.y * p);
}
const screen = ctx => { const k = ctx._pre || 1; ctx.setTransform(k, 0, 0, k, 0, 0); };
// cheap depth-of-field: draw a layer into a downscaled buffer, soften, upscale back
const LB = {};
function blurred(ctx, px, fn) {
  if (!px || px < 0.6) { fn(ctx); return; }
  const k = Math.round(clamp(1.6 / px, 0.1, 0.6) * 20) / 20;
  if (!LB[k]) { const a = document.createElement('canvas'), b = document.createElement('canvas'); a.width = b.width = Math.ceil(W * k); a.height = b.height = Math.ceil(H * k); LB[k] = [a, b]; }
  const [a, b] = LB[k], g = a.getContext('2d'), g2 = b.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, a.width, a.height); g._pre = k; g.filter = 'none'; g.globalAlpha = 1;
  g.save(); fn(g); g.restore();
  g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, b.width, b.height); g2.filter = 'blur(1px)'; g2.drawImage(a, 0, 0); g2.filter = 'none';
  ctx.save(); const pk = ctx._pre || 1; ctx.setTransform(pk, 0, 0, pk, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(b, 0, 0, W, H); ctx.restore();
}
function shake(t, t0, amt = 30, dur = 0.5) {
  if (t < t0) return [0, 0];
  const k = Math.exp(-(t - t0) * 5 / dur) * amt * (t - t0 < dur * 1.5 ? 1 : 0);
  return [noise(t * 40) * k, noise(t * 40 + 50) * k];
}

// ---------- drawing primitives ----------
const OUT = '#14110f';
function capsule(ctx, x, y1, y2, r) { // vertical capsule from y1 (top) to y2 (bottom)
  ctx.beginPath(); ctx.arc(x, y1 + r, r, Math.PI, 0); ctx.lineTo(x + r, y2 - r); ctx.arc(x, y2 - r, r, 0, Math.PI); ctx.closePath();
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }
function stroke(ctx, w, c = OUT) { ctx.lineWidth = w; ctx.strokeStyle = c; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
function fill(ctx, c) { ctx.fillStyle = c; ctx.fill(); }
function shade(c, k) { // darken/lighten hex color
  const n = parseInt(c.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = v => clamp(Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k), 0, 255);
  return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
}

// ---------- the signature character ----------
// o: x,y,s,f(facing 1/-1),coat,hat,plume,mood,gait,ph,lean,arms,stache,sweat,steam,belts,epaulettes,medals,rot,legs
function guy(ctx, o) {
  const s = o.s || 1, f = o.f || 1, ph = o.ph || 0;
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot || 0); ctx.scale(s * f, s);
  const LW = 7;
  let la = 0, lb = 0, lifta = 0, liftb = 0, bob = 0, aa = 0.15, ab = -0.15, lean = o.lean || 0, raise = 0;
  const g = o.gait || 'stand';
  if (g === 'march') {
    la = Math.sin(ph) * 0.38; lb = -la; lifta = Math.max(0, Math.sin(ph)) * 34; liftb = Math.max(0, -Math.sin(ph)) * 34;
    bob = -Math.abs(Math.sin(ph)) * 7; aa = -la * 1.3; ab = la * 1.3;
  } else if (g === 'stumble') {
    const n1 = noise(ph * 0.7 + (o.seed || 0)), n2 = noise(ph * 0.9 + 9 + (o.seed || 0));
    la = Math.sin(ph) * 0.5 + n1 * 0.3; lb = -Math.sin(ph) * 0.4 + n2 * 0.3; lifta = Math.max(0, Math.sin(ph)) * 22; liftb = Math.max(0, -Math.sin(ph)) * 22;
    lean += n1 * 0.32; aa = 1.2 + n2 * 0.8; ab = -1.4 + n1 * 0.8; bob = -Math.abs(Math.sin(ph)) * 10;
  } else if (g === 'tiptoe') {
    la = Math.sin(ph) * 0.22; lb = -la; lifta = Math.max(0, Math.sin(ph)) * 30 + 12; liftb = Math.max(0, -Math.sin(ph)) * 30 + 12;
    bob = -14 - Math.abs(Math.sin(ph)) * 10; raise = 1;
  } else if (g === 'walk') {
    la = Math.sin(ph) * 0.3; lb = -la; lifta = Math.max(0, Math.sin(ph)) * 14; liftb = Math.max(0, -Math.sin(ph)) * 14; bob = -Math.abs(Math.sin(ph)) * 5; aa = -la; ab = la;
  }
  ctx.rotate(lean);
  // legs
  const leg = (hx, a, lift) => {
    const fx = hx + Math.sin(a) * 80, fy = -lift;
    ctx.beginPath(); ctx.moveTo(hx, -78 + bob); ctx.lineTo(fx, fy - 4); stroke(ctx, LW);
    if (o.bare) { ell(ctx, fx + 8, fy - 4, 14, 7); fill(ctx, '#f3e6cf'); stroke(ctx, 5); }
    else { ell(ctx, fx + 9, fy - 6, 19, 10); fill(ctx, '#17161a'); ell(ctx, fx + 13, fy - 10, 7, 3); fill(ctx, 'rgba(255,255,255,.35)'); }
  };
  if (o.legs !== false) { leg(-12, lb, liftb); leg(12, la, lifta); }
  const by = bob;
  const shoulder = [0, -172 + by];
  // arms
  const arm = (side, ang, front) => {
    const pose = o.arms || 'swing';
    let x0 = shoulder[0] + side * 4, y0 = shoulder[1], pts;
    if (pose === 'swing') pts = [[x0 + Math.sin(ang) * 80, y0 + Math.cos(ang) * 80]];
    else if (pose === 'up') pts = [[x0 + side * 40, y0 - 50], [x0 + side * 55, y0 - 110]];
    else if (pose === 'back') pts = [[x0 - 30, y0 + 50]];
    else if (pose === 'hips') pts = [[x0 + side * 48, y0 + 30], [x0 + side * 24, y0 + 62]];
    else if (pose === 'point') pts = front ? [[x0 + 95, y0 - 25]] : [[x0 - 15, y0 + 78]];
    else if (pose === 'chest') pts = [[x0 + 30 + side * 10, y0 + 40], [x0 + 46, y0 + 6]];
    else if (pose === 'push') pts = [[x0 + 60, y0 + 10], [x0 + 105, y0 + 6]];
    else if (pose === 'flail') { const k = noise((o.ph || 0) * 2 + side * 3); pts = [[x0 + side * 50 + k * 30, y0 - 60 - k * 20]]; }
    else if (pose === 'stiff') pts = [[x0 + side * 6, y0 + 85]];
    else if (pose === 'hold') pts = [[x0 + 40 + side * 20, y0 + 30], [x0 + 70 + side * 46, y0 + 20]];
    else if (pose === 'pull') { const k = o.pull || 0; pts = [[x0 + 40 + side * (24 + k * 20), y0 + 28], [x0 + 70 + side * (52 + k * 46), y0 + 18]]; }
    else if (pose === 'sand') pts = front ? [[x0 + 60, y0 - 30 + Math.sin(o.sandT || 0) * 14], [x0 + 105, y0 - 70 + Math.sin(o.sandT || 0) * 24]] : [[x0 - 10, y0 + 80]];
    else if (pose === 'cup') pts = front ? [[x0 + 50, y0 + 40], [x0 + 64, y0 - 4]] : [[x0 - 10, y0 + 80]];
    else if (pose === 'clap') { const k = Math.abs(Math.sin((o.clapT || 0) * 14)); pts = [[x0 + 40, y0 + 30], [x0 + 60 + side * (6 + k * 22), y0 - 6]]; }
    else pts = [[x0, y0 + 80]];
    ctx.beginPath(); ctx.moveTo(x0, y0); for (const p of pts) ctx.lineTo(p[0], p[1]); stroke(ctx, LW);
    if (o.arms === 'sand' && front) { const p = pts[pts.length - 1]; rr(ctx, p[0] - 10, p[1] - 22, 34, 26, 6); fill(ctx, '#d9b26a'); stroke(ctx, 5); }
    if (o.arms === 'cup' && front) { const p = pts[pts.length - 1]; ctx.beginPath(); ctx.moveTo(p[0] - 18, p[1] - 30); ctx.lineTo(p[0] + 18, p[1] - 30); ctx.lineTo(p[0] + 12, p[1] + 2); ctx.lineTo(p[0] - 12, p[1] + 2); ctx.closePath(); fill(ctx, '#ffffff'); stroke(ctx, 5); ctx.beginPath(); ctx.arc(p[0] + 20, p[1] - 16, 9, -1.2, 1.2); stroke(ctx, 4); }
    if (o.cane && front) { const p = pts[pts.length - 1]; ctx.beginPath(); ctx.moveTo(p[0], p[1] - 10); ctx.lineTo(p[0] + 10, p[1] + 130); stroke(ctx, 9, '#4a2b16'); }
  };
  arm(-1, ab, false);
  // body capsule (coat)
  const coat = o.coat || '#3d6fd8';
  capsule(ctx, 0, -205 + by, -70 + by, 44); fill(ctx, coat);
  ctx.save(); capsule(ctx, 0, -205 + by, -70 + by, 44); ctx.clip();
  ell(ctx, -36, -130 + by, 40, 110); fill(ctx, shade(coat, -0.28)); // cel shadow on back side
  ell(ctx, 22, -170 + by, 10, 26, 0.3); fill(ctx, shade(coat, 0.35));
  if (o.belts) { ctx.beginPath(); ctx.moveTo(-40, -200 + by); ctx.lineTo(40, -90 + by); ctx.moveTo(40, -200 + by); ctx.lineTo(-40, -90 + by); stroke(ctx, 11, '#f4efe4'); }
  if (o.bare) { ctx.beginPath(); for (let i = 0; i < 4; i++) { ell(ctx, 10, -175 + i * 26 + by, 4, 4); fill(ctx, '#c9b79a'); } }
  else for (let i = 0; i < 4; i++) { ell(ctx, 14, -180 + i * 26 + by, 5, 5); fill(ctx, '#ffd34d'); }
  ctx.restore();
  capsule(ctx, 0, -205 + by, -70 + by, 44); stroke(ctx, LW);
  if (o.epaulettes) { ell(ctx, 30, -196 + by, 22, 10, 0.2); fill(ctx, '#ffc93a'); stroke(ctx, 5); }
  if (o.medals) for (let i = 0; i < 3; i++) {
    const mx = 6 + i * 18, my = -168 + by + (i % 2) * 6; ctx.beginPath(); ctx.rect(mx - 5, my - 18, 10, 14); fill(ctx, ['#d43c3c', '#3c7bd4', '#2fae6a'][i]);
    ell(ctx, mx, my + 2, 8, 8); fill(ctx, '#ffd34d'); stroke(ctx, 3);
    const gl = o.glint ? clamp(Math.sin(o.glint + i * 1.7)) : 0; if (gl > 0.7) { ctx.save(); ctx.globalAlpha = (gl - 0.7) * 3; star(ctx, mx + 4, my - 2, 18); ctx.restore(); }
  }
  arm(1, aa, true);
  // head
  const hx = 0, hy = -262 + by, face = o.mood === 'angry' ? '#9d5bc6' : (o.face || '#f7f0e1');
  ctx.save(); ctx.translate(hx, hy); if (o.chin) ctx.rotate(-o.chin);
  ell(ctx, 0, 0, 54, 58); fill(ctx, face);
  ctx.save(); ell(ctx, 0, 0, 54, 58); ctx.clip(); ell(ctx, -30, 18, 50, 58); fill(ctx, shade(face, -0.12)); ctx.restore();
  ell(ctx, 0, 0, 54, 58); stroke(ctx, LW);
  drawFace(ctx, o);
  drawHat(ctx, o);
  ctx.restore();
  if (o.sweat) { const k = (o.sweatT || 0) % 1; ctx.save(); ctx.translate(48, hy - 30 + k * 30); ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(12, 4, 0, 8); ctx.quadraticCurveTo(-12, 4, 0, -16); fill(ctx, '#7fd0ff'); stroke(ctx, 3.5); ctx.restore(); }
  if (o.wet) for (let i = 0; i < 9; i++) { const k = ((o.wetT || 0) * 1.4 + i / 9) % 1; ell(ctx, -60 + rnd(i) * 120, hy - 40 + k * 260, 6, 10); fill(ctx, '#7fd0ff'); stroke(ctx, 2.5); }
  if (o.steam) for (let i = 0; i < 4; i++) {
    const k = ((o.steamT || 0) * 0.9 + i / 4) % 1; ctx.save(); ctx.globalAlpha = 0.85 * (1 - k);
    ell(ctx, (i % 2 ? 1 : -1) * (20 + k * 30), hy - 110 - k * 140, 18 + k * 30, 14 + k * 24); fill(ctx, '#f2f2f2'); stroke(ctx, 4, 'rgba(20,17,15,.5)'); ctx.restore();
  }
  ctx.restore();
}
function star(ctx, x, y, r) {
  ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr2 = i % 2 ? r * 0.25 : r; ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } ctx.closePath(); fill(ctx, '#fffbe0');
}
function drawFace(ctx, o) {
  const m = o.mood || 'neutral', ex = 10;
  const dot = (x, y, r = 6) => { ell(ctx, x, y, r, r * 1.15); fill(ctx, OUT); };
  const line = (pts, w = 6) => { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); stroke(ctx, w); };
  const curve = (x1, y1, cx, cy, x2, y2, w = 6) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); stroke(ctx, w); };
  const L = ex - 19, R = ex + 19;
  if (m === 'shock') {
    for (const x of [L, R]) { ell(ctx, x, -6, 16, 17); fill(ctx, '#fff'); stroke(ctx, 5); dot(x + 2, -5, 4.5); }
    line([L - 12, -34, L + 8, -40]); line([R - 8, -40, R + 12, -34]);
    ell(ctx, ex, 30, 9, 12); fill(ctx, '#3a1414'); stroke(ctx, 4);
  } else if (m === 'laugh') {
    curve(L - 10, -4, L, -18, L + 10, -4); curve(R - 10, -4, R, -18, R + 10, -4);
    ctx.beginPath(); ctx.moveTo(ex - 24, 16); ctx.quadraticCurveTo(ex, 56, ex + 26, 16); ctx.closePath(); fill(ctx, '#5a1d1d'); stroke(ctx, 5);
    ctx.beginPath(); ctx.moveTo(ex - 20, 18); ctx.lineTo(ex + 22, 18); ctx.lineTo(ex + 18, 26); ctx.lineTo(ex - 16, 26); ctx.closePath(); fill(ctx, '#fff');
  } else if (m === 'yell') {
    line([L - 10, -6, L + 10, -2]); line([R - 10, -2, R + 10, -6]); line([L - 12, -26, L + 10, -16]); line([R - 10, -16, R + 12, -26]);
    ell(ctx, ex, 28, 22, 20 + (o.mouth || 0) * 8); fill(ctx, '#5a1d1d'); stroke(ctx, 5); ell(ctx, ex, 38, 12, 6); fill(ctx, '#e86b6b');
  } else if (m === 'angry') {
    dot(L, -2, 5); dot(R, -2, 5); line([L - 12, -24, L + 10, -12], 8); line([R - 10, -12, R + 12, -24], 8);
    line([ex - 16, 30, ex - 6, 24, ex + 4, 30, ex + 14, 24], 6);
  } else if (m === 'smug') {
    curve(L - 10, -6, L, 0, L + 10, -6); curve(R - 10, -6, R, 0, R + 10, -6); line([L - 10, -16, L + 10, -20]); line([R - 10, -20, R + 10, -16]);
    curve(ex - 16, 26, ex + 4, 34, ex + 20, 20);
  } else if (m === 'proud') {
    curve(L - 10, -2, L, -12, L + 10, -2); curve(R - 10, -2, R, -12, R + 10, -2); curve(ex - 18, 22, ex, 36, ex + 18, 22);
  } else if (m === 'scared') {
    dot(L, -4, 4.5); dot(R, -4, 4.5); line([L - 10, -18, L + 8, -26]); line([R - 8, -26, R + 10, -18]);
    line([ex - 18, 30, ex - 9, 24, ex, 30, ex + 9, 24, ex + 18, 30], 5);
  } else if (m === 'happy') {
    dot(L, -4); dot(R, -4); curve(ex - 20, 18, ex, 40, ex + 20, 18);
  } else if (m === 'dizzy') {
    for (const x of [L, R]) { ctx.beginPath(); for (let a = 0; a < 12; a += 0.4) ctx.lineTo(x + Math.cos(a + (o.ph || 0)) * a * 0.9, -4 + Math.sin(a + (o.ph || 0)) * a * 0.9); stroke(ctx, 3.5); }
    curve(ex - 14, 28, ex, 22, ex + 14, 30);
  } else if (m === 'stern') {
    dot(L, -4); dot(R, -4); line([L - 10, -20, L + 10, -16]); line([R - 10, -16, R + 10, -20]); line([ex - 12, 28, ex + 12, 28]);
  } else { dot(L, -4); dot(R, -4); line([ex - 10, 28, ex + 10, 28]); }
  if (o.stache === 'handlebar') {
    ctx.beginPath(); ctx.moveTo(ex, 12);
    ctx.bezierCurveTo(ex - 20, 2, ex - 44, 6, ex - 52, -10); ctx.bezierCurveTo(ex - 58, 6, ex - 40, 26, ex, 20);
    ctx.bezierCurveTo(ex + 40, 26, ex + 58, 6, ex + 52, -10); ctx.bezierCurveTo(ex + 44, 6, ex + 20, 2, ex, 12); fill(ctx, '#3b2416'); stroke(ctx, 3);
  } else if (o.stache === 'walrus') {
    ctx.beginPath(); ctx.moveTo(ex - 30, 22); ctx.quadraticCurveTo(ex, -2, ex + 30, 22); ctx.quadraticCurveTo(ex, 14, ex - 30, 22); fill(ctx, '#d9d4cc'); stroke(ctx, 4);
  } else if (o.stache === 'droop') {
    ctx.beginPath(); ctx.moveTo(ex, 12); ctx.bezierCurveTo(ex - 20, 12, ex - 30, 30, ex - 28, 54); ctx.bezierCurveTo(ex - 20, 34, ex - 10, 24, ex, 22);
    ctx.bezierCurveTo(ex + 10, 24, ex + 20, 34, ex + 28, 54); ctx.bezierCurveTo(ex + 30, 30, ex + 20, 12, ex, 12); fill(ctx, '#3b2416'); stroke(ctx, 3);
  }
}
function drawHat(ctx, o) {
  const h = o.hat; if (!h) return;
  if (h === 'shako') {
    ctx.beginPath(); ctx.moveTo(-44, -38); ctx.lineTo(-50, -118); ctx.lineTo(50, -118); ctx.lineTo(44, -38); ctx.closePath(); fill(ctx, '#1d2140');
    ctx.save(); ctx.clip(); ctx.fillStyle = '#323866'; ctx.fillRect(10, -130, 40, 100); ctx.fillStyle = '#ffcc3d'; ctx.fillRect(-60, -56, 120, 9); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-44, -38); ctx.lineTo(-50, -118); ctx.lineTo(50, -118); ctx.lineTo(44, -38); ctx.closePath(); stroke(ctx, 6);
    ctx.beginPath(); ctx.moveTo(-10, -38); ctx.quadraticCurveTo(40, -40, 66, -26); ctx.lineTo(44, -38); fill(ctx, '#0d0d12'); stroke(ctx, 5);
    ell(ctx, 6, -84, 12, 14); fill(ctx, '#ffcc3d'); stroke(ctx, 4);
    ell(ctx, 0, -140, 15, 24); fill(ctx, o.plume || '#f4f1ea'); stroke(ctx, 5);
  } else if (h === 'bicorne' || h === 'general') {
    const k = h === 'general' ? 1.15 : 1;
    ctx.beginPath(); ctx.moveTo(-82 * k, -36); ctx.quadraticCurveTo(-60, -112 * k, 0, -116 * k); ctx.quadraticCurveTo(60, -112 * k, 82 * k, -36); ctx.quadraticCurveTo(0, -60, -82 * k, -36);
    fill(ctx, '#1a1a22'); stroke(ctx, 6);
    ctx.beginPath(); ctx.moveTo(-74 * k, -44); ctx.quadraticCurveTo(-54, -102 * k, 0, -106 * k); ctx.quadraticCurveTo(54, -102 * k, 74 * k, -44); stroke(ctx, 5, '#ffc93a');
    ell(ctx, 14, -76, 14, 14); fill(ctx, o.plume || '#3d6fd8'); stroke(ctx, 4);
    if (h === 'general') { ctx.beginPath(); ctx.moveTo(10, -110); ctx.quadraticCurveTo(-40, -170, -90, -150); ctx.quadraticCurveTo(-40, -140, 10, -100); fill(ctx, '#f4f1ea'); stroke(ctx, 4); }
  } else if (h === 'cap') {
    ctx.beginPath(); ctx.arc(0, -26, 54, Math.PI * 1.05, -0.05); ctx.closePath(); fill(ctx, '#ff8a3d'); stroke(ctx, 6);
    ctx.beginPath(); ctx.moveTo(30, -30); ctx.quadraticCurveTo(70, -32, 84, -20); ctx.lineTo(40, -22); fill(ctx, '#e0632a'); stroke(ctx, 5);
  } else if (h === 'wet') {
    ctx.beginPath(); ctx.moveTo(-30, -48); ctx.quadraticCurveTo(-10, -70, 10, -54); ctx.quadraticCurveTo(20, -70, 34, -46); stroke(ctx, 6);
  }
}
// big leather boot (close-ups) with trouser leg; origin at sole contact
function boot(ctx, x, y, s, trouser = '#e9e4d8', f = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * f, s);
  ctx.beginPath(); ctx.rect(-44, -420, 88, 300); fill(ctx, trouser);
  ctx.save(); ctx.clip(); ctx.fillStyle = shade(trouser, -0.2); ctx.fillRect(-44, -420, 30, 300); ctx.restore();
  ctx.beginPath(); ctx.rect(-44, -420, 88, 300); stroke(ctx, 7);
  ctx.beginPath(); ctx.moveTo(-48, -150); ctx.lineTo(-50, -30); ctx.quadraticCurveTo(-50, 0, -20, 0); ctx.lineTo(96, 0); ctx.quadraticCurveTo(118, -2, 112, -26);
  ctx.quadraticCurveTo(104, -52, 46, -66); ctx.lineTo(48, -150); ctx.closePath(); fill(ctx, '#1b1a20');
  ctx.save(); ctx.clip(); ell(ctx, -40, -40, 40, 140); fill(ctx, '#0c0b10'); ell(ctx, 70, -38, 26, 9, -0.25); fill(ctx, 'rgba(255,255,255,.55)'); ell(ctx, 10, -110, 7, 30); fill(ctx, 'rgba(255,255,255,.4)'); ctx.restore();
  ctx.beginPath(); ctx.moveTo(-48, -150); ctx.lineTo(-50, -30); ctx.quadraticCurveTo(-50, 0, -20, 0); ctx.lineTo(96, 0); ctx.quadraticCurveTo(118, -2, 112, -26);
  ctx.quadraticCurveTo(104, -52, 46, -66); ctx.lineTo(48, -150); ctx.closePath(); stroke(ctx, 7);
  ctx.beginPath(); ctx.rect(-54, -6, 172, 12); fill(ctx, '#5a3a20'); stroke(ctx, 5);
  ctx.restore();
}
function dust(ctx, x, y, t, t0, s = 1, n = 9, col = '#d9c9a6') {
  const k = t - t0; if (k < 0 || k > 0.9) return;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI, sp = (90 + rnd(i + t0) * 120) * s, e = easeOut(k / 0.9);
    ctx.save(); ctx.globalAlpha = (1 - e) * 0.9;
    ell(ctx, x + Math.cos(a) * sp * e * 1.6, y + Math.sin(a) * sp * e * 0.35 - 10 * s, (18 + 30 * e) * s, (14 + 22 * e) * s); fill(ctx, col); ctx.restore();
  }
}
function splash(ctx, x, y, t, t0, s = 1) {
  const k = t - t0; if (k < 0 || k > 1.2) return;
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + (rnd(i * 3 + t0) - 0.5) * 2.2, v = (300 + rnd(i + t0 * 7) * 400) * s;
    const px = x + Math.cos(a) * v * k, py = y + Math.sin(a) * v * k + 900 * s * k * k;
    if (py > y + 10) continue;
    ctx.save(); ctx.globalAlpha = 1 - k / 1.2; ell(ctx, px, py, 12 * s, 16 * s); fill(ctx, '#e8f8ff'); stroke(ctx, 3 * s, '#2a6f9e'); ctx.restore();
  }
  ctx.save(); ctx.globalAlpha = 1 - k / 1.2; ell(ctx, x, y, 80 * s * (0.5 + k), 16 * s * (0.5 + k)); stroke(ctx, 6 * s, '#e8f8ff'); ctx.restore();
}
function cloud(ctx, x, y, s, col = '#ffffff', sh = '#c9def5') {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const blobs = [[-120, 0, 70], [-40, -40, 90], [60, -20, 80], [140, 10, 60], [0, 20, 90]];
  ctx.beginPath(); for (const b of blobs) { ctx.moveTo(b[0] + b[2], b[1]); ctx.arc(b[0], b[1], b[2], 0, Math.PI * 2); } fill(ctx, sh);
  ctx.beginPath(); for (const b of blobs) { ctx.moveTo(b[0] + b[2] * 0.9, b[1] - 12); ctx.arc(b[0], b[1] - 12, b[2] * 0.9, 0, Math.PI * 2); } fill(ctx, col);
  ctx.restore();
}
