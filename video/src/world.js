// The river valley with the chain bridge (shared by most scenes) + looks/palettes.
const LOOKS = {
  morning: { skyT: '#3a94ee', skyB: '#c4ecff', far: '#8fc2c7', mid: '#69ab61', ground: '#7fc45a', groundD: '#4c8c3a', water: '#3ea2d6', waterD: '#1d5c93', sun: '#fff6c8', tint: '#fff3d0', tintA: 0.0, cloud: '#ffffff', cloudS: '#cfe3f7', stone: '#c9b99b' },
  golden: { skyT: '#e8705a', skyB: '#ffd38c', far: '#c99a8b', mid: '#9c8c4c', ground: '#b9a64e', groundD: '#7a6a2d', water: '#e39a62', waterD: '#7a4a5c', sun: '#fff1b8', tint: '#ffb35c', tintA: 0.10, cloud: '#ffe4c4', cloudS: '#f0a58a', stone: '#d8b88e' },
  storm: { skyT: '#262a4f', skyB: '#7b6f9e', far: '#525a7e', mid: '#3c5b4b', ground: '#4c7a45', groundD: '#2c4b2f', water: '#2d5d85', waterD: '#14304d', sun: '#d9d9ff', tint: '#6a5acd', tintA: 0.10, cloud: '#8d8fb5', cloudS: '#4f5179', stone: '#8f8a9e' },
  night: { skyT: '#0e1340', skyB: '#3c2f7c', far: '#2b2e66', mid: '#203157', ground: '#22405a', groundD: '#13293c', water: '#1d396d', waterD: '#0b1836', sun: '#fff6d6', tint: '#2a2f8a', tintA: 0.12, cloud: '#4a4f8f', cloudS: '#2c2f63', stone: '#5d6185' },
};
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = i => Math.round(lerp((pa >> i) & 255, (pb >> i) & 255, t));
  return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
}
function mixLook(a, b, t) { const o = {}; for (const k in a) o[k] = typeof a[k] === 'number' ? lerp(a[k], b[k], t) : mixHex(a[k], b[k], t); return o; }

const X0 = -700, X1 = 700;
// bridge state: amp (deck bounce), osc (-1..1), tilt (rad), snapped (0..1), shine
function deckPt(B, x) {
  const u = (x - X0) / (X1 - X0);
  let y = (B.amp || 0) * Math.sin(Math.PI * clamp(u)) * (B.osc || 0);
  const th = B.tilt || 0;
  if (th) { const dx = x - X0; return { x: X0 + dx * Math.cos(th) - y * Math.sin(th), y: dx * Math.sin(th) + y * Math.cos(th), a: th }; }
  const dydx = (B.amp || 0) * Math.PI / (X1 - X0) * Math.cos(Math.PI * clamp(u)) * (B.osc || 0);
  return { x, y, a: Math.atan(dydx) };
}
function chainY(B, x) {
  const u = x / 760; const base = -470 + 420 * (1 - u * u);
  const d = deckPt(B, clamp(x, X0, X1)).y; return base + (B.tilt ? 0 : d * 0.85 * (1 - u * u));
}

function drawSky(ctx, L, c) {
  screen(ctx);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, L.skyT); g.addColorStop(0.75, L.skyB); g.addColorStop(1, L.skyB);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function drawValley(ctx, c, L, t, opt = {}) {
  drawSky(ctx, L, c);
  const dof = opt.dof || 0;
  // sun / moon
  cam(ctx, c, 0.05);
  const sunPos = opt.sun || [380, -1500];
  const sg = ctx.createRadialGradient(sunPos[0], sunPos[1], 10, sunPos[0], sunPos[1], 520);
  sg.addColorStop(0, L.sun); sg.addColorStop(0.25, L.sun + 'aa'); sg.addColorStop(1, L.sun + '00'); ctx.fillStyle = sg; ctx.fillRect(sunPos[0] - 600, sunPos[1] - 600, 1200, 1200);
  ell(ctx, sunPos[0], sunPos[1], 120, 120); fill(ctx, L.sun);
  if (opt.night) { ell(ctx, sunPos[0] + 40, sunPos[1] - 20, 105, 105); fill(ctx, L.skyT); for (let i = 0; i < 60; i++) { ell(ctx, (rnd(i) - 0.5) * 3000, -2400 + rnd(i + 3) * 1500, 3, 3); fill(ctx, '#fffbe0'); } }
  // clouds
  blurred(ctx, dof * 4, ctx => {
  cam(ctx, c, 0.15);
  for (let i = 0; i < 7; i++) {
    const x = ((rnd(i) * 5000 + t * (12 + i * 4)) % 5000) - 2500, y = -1650 + rnd(i + 20) * 700;
    cloud(ctx, x, y, 0.8 + rnd(i + 40) * 0.9, L.cloud, L.cloudS);
  }
  // far hills
  cam(ctx, c, 0.32);
  ctx.beginPath(); ctx.moveTo(-5000, 3000);
  for (let x = -5000; x <= 5000; x += 100) ctx.lineTo(x, -170 + noise(x / 900) * 140 + noise(x / 300 + 4) * 40);
  ctx.lineTo(5000, 3000); ctx.closePath(); fill(ctx, L.far); paint(ctx, 0.25, 1.4);
  // little town on far hills
  for (let i = 0; i < 9; i++) {
    const x = -1500 + i * 130 + rnd(i) * 40, y = -150 + noise(x / 900) * 140 + noise(x / 300 + 4) * 40 + 30, h = 50 + rnd(i + 5) * 50;
    ctx.beginPath(); ctx.rect(x, y - h, 70, h + 30); fill(ctx, shade(L.far, 0.25)); ctx.beginPath(); ctx.moveTo(x - 8, y - h); ctx.lineTo(x + 35, y - h - 40); ctx.lineTo(x + 78, y - h); fill(ctx, shade(L.far, -0.25));
    if (opt.night) { ctx.beginPath(); ctx.rect(x + 25, y - h + 14, 16, 16); fill(ctx, '#ffd36b'); }
  }
  });
  // mid hills with trees
  blurred(ctx, dof * 2.5, ctx => {
  cam(ctx, c, 0.58);
  ctx.beginPath(); ctx.moveTo(-5000, 3000);
  for (let x = -5000; x <= 5000; x += 80) ctx.lineTo(x, -95 + noise(x / 600 + 11) * 70);
  ctx.lineTo(5000, 3000); ctx.closePath(); fill(ctx, L.mid); paint(ctx, 0.3, 1.2);
  for (let i = 0; i < 40; i++) {
    const x = -3000 + i * 150 + rnd(i + 70) * 60; if (Math.abs(x) < 260) continue;
    const y = -95 + noise(x / 600 + 11) * 70 + 10, r = 34 + rnd(i) * 26;
    ctx.beginPath(); ctx.rect(x - 5, y - 10, 10, 26); fill(ctx, '#4a3424');
    ell(ctx, x, y - r, r * 0.8, r); fill(ctx, shade(L.mid, -0.2)); ell(ctx, x + 8, y - r - 8, r * 0.5, r * 0.6); fill(ctx, shade(L.mid, 0.12));
  }
  });
  // near ground + river
  cam(ctx, c, 1);
  const gg = ctx.createLinearGradient(0, -80, 0, 1800); gg.addColorStop(0, shade(L.ground, -0.08)); gg.addColorStop(1, L.ground);
  ctx.beginPath(); ctx.rect(-6000, -60, 12000, 9000); ctx.fillStyle = gg; ctx.fill(); paint(ctx, 0.3, 1.6);
  waterPath(ctx);
  const wg = ctx.createLinearGradient(0, -60, 0, 1800); wg.addColorStop(0, L.waterD); wg.addColorStop(0.35, L.water); wg.addColorStop(1, shade(L.water, 0.15));
  ctx.fillStyle = wg; ctx.fill(); paint(ctx, 0.25, 1);
  ctx.save(); waterPath(ctx); ctx.clip();
  for (let i = 0; i < 46; i++) { // wave strokes
    const y = 30 + i * 36, x = ((rnd(i) * 1600 + t * 40 * (1 + rnd(i + 3))) % 1600) - 800, w2 = 40 + y * 0.08;
    ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.moveTo(x - w2, y); ctx.quadraticCurveTo(x, y - 8, x + w2, y); stroke(ctx, 4 + y * 0.004, shade(L.water, 0.45));
  }
  ctx.globalAlpha = 1; ctx.restore();
  waterPath(ctx); stroke(ctx, 10, shade(L.groundD, -0.3));
  // rocks on banks
  for (let i = 0; i < 10; i++) { const side = i % 2 ? 1 : -1, y = 120 + i * 130, x = side * (140 + y * 0.62) + side * 30; ell(ctx, x, y, 34 + y * 0.03, 20 + y * 0.02); fill(ctx, L.stone); stroke(ctx, 5); }
}
function waterPath(ctx) {
  ctx.beginPath(); ctx.moveTo(-120, -60); ctx.lineTo(120, -60); ctx.lineTo(1700, 1900); ctx.lineTo(-1700, 1900); ctx.closePath();
}

function drawTower(ctx, x, L) {
  ctx.beginPath(); ctx.moveTo(x - 72, 120); ctx.lineTo(x - 58, -500); ctx.lineTo(x + 58, -500); ctx.lineTo(x + 72, 120); ctx.closePath(); fill(ctx, L.stone);
  ctx.save(); ctx.clip();
  ctx.fillStyle = shade(L.stone, -0.25); ctx.fillRect(x - 80, -520, 40, 700);
  ctx.strokeStyle = shade(L.stone, -0.35); ctx.lineWidth = 3;
  for (let y = -480; y < 120; y += 46) { ctx.beginPath(); ctx.moveTo(x - 80, y); ctx.lineTo(x + 80, y); ctx.stroke(); for (let k = 0; k < 3; k++) { const bx = x - 60 + k * 50 + ((y / 46) % 2) * 25; ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx, y + 46); ctx.stroke(); } }
  ctx.beginPath(); ctx.moveTo(x - 30, 40); ctx.lineTo(x - 30, -120); ctx.arc(x, -120, 30, Math.PI, 0); ctx.lineTo(x + 30, 40); ctx.closePath(); fill(ctx, shade(L.stone, -0.55));
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(x - 72, 120); ctx.lineTo(x - 58, -500); ctx.lineTo(x + 58, -500); ctx.lineTo(x + 72, 120); ctx.closePath(); stroke(ctx, 8);
  ctx.beginPath(); ctx.rect(x - 70, -530, 140, 34); fill(ctx, shade(L.stone, 0.15)); stroke(ctx, 7);
}
// draws bridge; people callback draws persons standing on the deck between deck back edge and railing
function drawBridge(ctx, B, L, t, people) {
  drawTower(ctx, -760, L); drawTower(ctx, 760, L);
  // backstays
  ctx.beginPath(); ctx.moveTo(-760, -470); ctx.lineTo(-1250, 40); ctx.moveTo(760, -470); ctx.lineTo(1250, 40); stroke(ctx, 12, '#2a2a33');
  // chain (back)
  const chain = (off, col, w) => {
    ctx.beginPath();
    for (let x = -760; x <= 760; x += 20) {
      let y = chainY(B, x) + off;
      if (B.snapped && x > 0) y += B.snapped * (x / 760) * 520 * (1 - Math.abs(x / 760 - 0.5));
      x === -760 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    stroke(ctx, w, col);
  };
  chain(-6, '#2a2a33', 14);
  // hangers
  for (let x = X0 + 50; x < X1; x += 70) {
    const d = deckPt(B, x), cy = chainY(B, x);
    if (B.snapped && x > -60) { ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + 10 * B.snapped, cy + 70); stroke(ctx, 5, '#2a2a33'); continue; }
    ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(d.x, d.y - 60); stroke(ctx, 5, '#2a2a33');
  }
  // deck (top surface + people + front face + rail)
  const seg = 28, pts = [];
  for (let x = X0; x <= X1 + 0.1; x += seg) pts.push(deckPt(B, x));
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y - 22) : ctx.moveTo(p.x, p.y - 22)); for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath(); fill(ctx, '#c98f55'); stroke(ctx, 5);
  if (people) people();
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].y + 30);
  ctx.closePath(); fill(ctx, '#7a4a28'); paint(ctx, 0.35, 0.6);
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].y + 30); ctx.closePath(); stroke(ctx, 7);
  for (let i = 0; i < pts.length; i += 2) { ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y + 2); ctx.lineTo(pts[i].x, pts[i].y + 28); stroke(ctx, 3, '#4a2a14'); }
  // railing (front)
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y - 58) : ctx.moveTo(p.x, p.y - 58)); stroke(ctx, 7, '#3a2618');
  for (let i = 0; i < pts.length; i += 2) { ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i].x, pts[i].y - 58); stroke(ctx, 5, '#3a2618'); }
  chain(4, '#1c1c22', 16);
  // chain links highlight + "brand new" glints
  for (let x = -740; x <= 740; x += 40) { let y = chainY(B, x) + 4; if (B.snapped && x > 0) y += B.snapped * (x / 760) * 520 * (1 - Math.abs(x / 760 - 0.5)); ell(ctx, x, y - 3, 9, 4); fill(ctx, 'rgba(255,255,255,.28)'); }
  if (B.shine) for (let i = 0; i < 6; i++) {
    const x = -700 + i * 280 + 100 * noise(i), k = clamp(Math.sin(t * 5 + i * 1.9)); if (k < 0.6) continue;
    ctx.save(); ctx.globalAlpha = (k - 0.6) * 2.5 * B.shine; star(ctx, x, chainY(B, x), 34); ctx.restore();
  }
}
// near-water overlay used to hide things that sink below the surface
function waterFront(ctx, L, t, y0 = 230) {
  ctx.save(); waterPath(ctx); ctx.clip();
  const g = ctx.createLinearGradient(0, y0, 0, y0 + 600); g.addColorStop(0, L.water); g.addColorStop(1, shade(L.water, 0.1));
  ctx.beginPath(); ctx.moveTo(-3000, y0); for (let x = -3000; x <= 3000; x += 40) ctx.lineTo(x, y0 + Math.sin(x / 60 + t * 6) * 6); ctx.lineTo(3000, 3000); ctx.lineTo(-3000, 3000); ctx.closePath();
  ctx.fillStyle = g; ctx.globalAlpha = 0.96; ctx.fill(); ctx.globalAlpha = 1;
  ctx.beginPath(); for (let x = -3000; x <= 3000; x += 40) x === -3000 ? ctx.moveTo(x, y0 + Math.sin(x / 60 + t * 6) * 6) : ctx.lineTo(x, y0 + Math.sin(x / 60 + t * 6) * 6); stroke(ctx, 6, shade(L.water, 0.5));
  ctx.restore();
}
function foreground(ctx, c, L, t, opt = {}) {
  blurred(ctx, opt.blur ?? 7, ctx => {
  cam(ctx, c, 1.45);
  const y0 = opt.y ?? 900;
  for (let i = 0; i < 26; i++) {
    const x = -1500 + i * 120 + rnd(i) * 60, h = 160 + rnd(i + 9) * 220, sw = Math.sin(t * 1.6 + i) * 18;
    ctx.beginPath(); ctx.moveTo(x - 14, y0 + 300); ctx.quadraticCurveTo(x + sw * 0.5, y0 - h * 0.5, x + sw, y0 - h); ctx.quadraticCurveTo(x + sw * 0.5 + 10, y0 - h * 0.5, x + 14, y0 + 300); fill(ctx, shade(L.groundD, -0.2 + rnd(i + 2) * 0.2));
  }
  });
}
