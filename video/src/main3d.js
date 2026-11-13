// 3D compositor: renders the Three.js frame, then 2D overlays (projected labels, subtitles, kinetic type).
import { init3d, render3d, project } from './w3d.js';
function blur3(t) {
  const win = [[EV.whip - 0.02, EV.whip + 0.32, 5], [sceneT('break')[1] - 0.22, sceneT('break')[1], 4], [EV.quote - 0.02, EV.quote + 0.2, 4],
    [EV.snap - 0.02, EV.snap + 0.3, 4], [EV.tilt - 0.1, EV.tilt + 0.45, 4], [EV.pushes[3], EV.pushes[3] + 0.9, 4], ...EV.left.map(x => [x - 0.25, x + 0.02, 4]), [EV.allboots - 0.25, EV.allboots + 0.02, 4]];
  for (const w of win) if (t >= w[0] && t <= w[1]) return w[2];
  return 1;
}
function label(ctx, s, x, y, size, rot = 0, sc = 1, col = '#fff') { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc); ctx.font = `900 ${size}px Baloo2`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.2; ctx.strokeStyle = OUT; ctx.strokeText(s, 0, 0); ctx.fillStyle = col; ctx.fillText(s, 0, 0); ctx.restore(); }
function extras(ctx, t, sh) {
  screen(ctx);
  if (sh.quack && sh.quack[3] > 0.2) { const [x, y] = project(...sh.quack.slice(0, 3)); label(ctx, 'QUACK', x - 60, y - 40, 70, -0.2, 0.6 + sh.quack[3] * 0.5); }
  if (sh.marks) for (const [a, b, y, al] of sh.marks) { const [x1, y1] = project(a, y, 0), [x2, y2] = project(b, y, 0); ctx.globalAlpha = al; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.moveTo(x1, y1 - 14); ctx.lineTo(x1, y1 + 14); ctx.moveTo(x2, y2 - 14); ctx.lineTo(x2, y2 + 14); ctx.lineWidth = 9; ctx.strokeStyle = OUT; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke(); label(ctx, '10 FT', (x1 + x2) / 2, (y1 + y2) / 2 - 34, 44); ctx.globalAlpha = 1; }
  if (sh.push) for (const [p, x, y, z] of sh.push) { const k = t - p; if (k > 0 && k < 0.4) { const [sx, sy] = project(x, y, z); ctx.globalAlpha = 1 - k / 0.4; label(ctx, 'PUSH!', sx, sy - k * 220, 78); ctx.globalAlpha = 1; } }
  if (sh.rings) { const [x, y] = project(...sh.rings); ctx.save(); ctx.globalAlpha = 0.6; for (let i = 1; i < 4; i++) { const r = 150 + i * 90 + ((t * 300) % 90); for (const a0 of [0, Math.PI]) { ctx.beginPath(); ctx.arc(x, y, r, a0 - 0.5, a0 + 0.5); ctx.lineWidth = 7; ctx.strokeStyle = '#fff'; ctx.stroke(); } } ctx.restore(); }
  if (sh.arrows) { const { B, front } = sh.arrows, ph = (t - T0) / BEAT, fr = ph - Math.floor(ph); if (fr < 0.35) for (let r = 0; r < 19; r += 2) { const x = front + r * 56, d = deckPt(B, x); const [sx, sy] = project(d.x, -d.y, 70); const off = fr * 120; ctx.globalAlpha = 1 - fr / 0.35; ctx.lineCap = 'round'; for (const [w, c] of [[16, OUT], [10, '#ffd34d']]) { ctx.beginPath(); ctx.moveTo(sx, sy + 10 + off); ctx.lineTo(sx, sy + 80 + off); ctx.moveTo(sx - 18, sy + 58 + off); ctx.lineTo(sx, sy + 82 + off); ctx.lineTo(sx + 18, sy + 58 + off); ctx.lineWidth = w; ctx.strokeStyle = c; ctx.stroke(); } ctx.globalAlpha = 1; } }
  if (sh.envelope) { ctx.save(); ctx.setLineDash([22, 16]); for (const sg of [-1, 1]) { ctx.beginPath(); for (let x = X0; x <= X1; x += 20) { const [sx, sy] = project(x, -15 + sg * 36 * Math.sin(Math.PI * (x - X0) / 1400), 70); x === X0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy); } ctx.lineWidth = 7; ctx.strokeStyle = '#fff'; ctx.stroke(); } ctx.restore(); }
  if (sh.xray) { // waveforms locking together
    const u = inv(sceneT('xray')[0], sceneT('xray')[1], t), ph = (t - T0) / BEAT, lock = sstep(0.1, 0.8, u), gy = 1400;
    ctx.font = '800 54px Baloo2'; ctx.textAlign = 'left'; ctx.fillStyle = '#7fd0ff'; ctx.fillText('BRIDGE BOUNCE', 70, gy - 100); ctx.fillStyle = '#ff7a6a'; ctx.fillText('MARCHING BEAT', 70, gy + 250);
    ctx.beginPath(); for (let x = 70; x <= 1010; x += 6) { const y = gy + Math.cos(2 * Math.PI * ((x - 70) / 235 - ph)) * (20 + 45 * lock); x === 70 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.lineWidth = 8; ctx.strokeStyle = '#7fd0ff'; ctx.stroke();
    for (let x = 70; x <= 1010; x += 235) { const xx = x + (1 - lock) * 70 * Math.sin(ph * 0.7); ctx.beginPath(); ctx.moveTo(xx, gy + 180); ctx.lineTo(xx, gy + 120); ctx.lineWidth = 10; ctx.strokeStyle = '#ff7a6a'; ctx.lineCap = 'round'; ctx.stroke(); }
  }
  if (sh.pluck && t < sh.pluck.tp + 0.1) { const a = -38 * sstep(sh.pluck.mc, sh.pluck.tp - 0.05, t); const [sx, sy] = project(40, 10 + a, 70); ctx.beginPath(); ctx.moveTo(sx + 260, sy + 900); ctx.lineTo(sx + 20, sy + 30); ctx.lineWidth = 18; ctx.strokeStyle = OUT; ctx.lineCap = 'round'; ctx.stroke(); ell(ctx, sx + 14, sy + 22, 24, 24); fill(ctx, '#f7f0e1'); stroke(ctx, 8); }
  if (sh.pluck && t > sh.pluck.tp) { const [sx, sy] = project(0, 0, 70); ctx.save(); ctx.globalAlpha = Math.exp(-(t - sh.pluck.tp) * 2); for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(sx, sy, 100 + i * 120 + (t - sh.pluck.tp) * 300, 0, Math.PI * 2); ctx.lineWidth = 6; ctx.strokeStyle = '#fff3d0'; ctx.stroke(); } ctx.restore(); }
  if (sh.flash) { ctx.fillStyle = 'rgba(255,240,200,.35)'; ctx.fillRect(0, 0, W, H); }
  if (sh.iris !== undefined && sh.iris < 1) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(W / 2, H / 2, sh.iris * 1300, 0, Math.PI * 2, true); fill(ctx, '#3a1414'); ctx.restore(); }
  const k74 = easeBack(inv(TL.phrases[24].start + 1.6, TL.phrases[24].start + 1.9, t)); if (sceneAt(t)[0] === 'pushes' && k74 > 0) { ctx.save(); ctx.translate(W / 2, 470); ctx.scale(k74, k74); ctx.rotate(-0.06); ctx.font = '900 260px Montserrat'; ctx.textAlign = 'center'; ctx.lineWidth = 26; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.strokeText('×74', 0, 0); ctx.fillStyle = '#ffd34d'; ctx.fillText('×74', 0, 0); ctx.restore(); }
}
export function setup() {
  init3d();
  window.renderAt = function (t) {
    const n = blur3(t), shutter = 1 / 60; let last;
    for (let i = 0; i < n; i++) {
      const ts = n === 1 ? t : t + (i / (n - 1) - 0.5) * shutter, tt = sceneAt(ts)[0] === sceneAt(t)[0] ? ts : t;
      last = render3d(tt); screen(CTX); CTX.globalAlpha = 1 / (i + 1); CTX.drawImage(last.gl, 0, 0); CTX.globalAlpha = 1;
    }
    extras(CTX, t, last.shot); post(CTX, t); overlays(CTX, t);
  };
}
