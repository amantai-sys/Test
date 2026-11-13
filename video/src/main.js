// Timeline, subtitles, kinetic type, post FX and motion blur. window.renderAt(t) draws one frame.
let CTX, BUF, BCTX, CHUNKS = [];
function init(timeline, events) {
  TL = timeline; EV = events; BEAT = EV.beat; T0 = EV.thumps[0];
  makeTextures();
  const cv = document.getElementById('c'); cv.width = W; cv.height = H; CTX = cv.getContext('2d');
  BUF = document.createElement('canvas'); BUF.width = W; BUF.height = H; BCTX = BUF.getContext('2d');
  // subtitle chunks: 1-2 words, never across sentence punctuation
  const words = TL.words.filter(w => !(w.p === 6 && /Break|step/.test(w.w)));
  for (let i = 0; i < words.length; i++) {
    const a = words[i], b = words[i + 1];
    const clean = s => s.replace(/["“”]/g, '');
    if (b && b.p === a.p && !/[.,?!]$/.test(clean(a.w)) && (clean(a.w) + ' ' + clean(b.w)).length <= 11) { CHUNKS.push({ text: clean(a.w) + ' ' + clean(b.w), s: a.s, e: b.e }); i++; }
    else CHUNKS.push({ text: clean(a.w), s: a.s, e: a.e });
  }
  for (let i = 0; i < CHUNKS.length; i++) { const n = CHUNKS[i + 1]; CHUNKS[i].end = n && n.s - CHUNKS[i].e < 0.5 ? n.s - 0.025 : Math.min(CHUNKS[i].e + 0.25, n ? n.s - 0.025 : 1e9); }
}
function sceneAt(t) { let s = EV.scenes[0]; for (const x of EV.scenes) if (t >= x[1]) s = x; return s; }
function drawScene(ctx, t) {
  const [id, t0] = sceneAt(t), [, t1] = sceneT(id);
  ctx.save(); ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  SCENES[id](ctx, t, t - t0, clamp((t - t0) / (t1 - t0)));
  ctx.restore(); screen(ctx);
}
// windows that get real sub-frame motion blur (fast camera / impacts)
function blurSamples(t) {
  const win = [[EV.whip - 0.02, EV.whip + 0.32, 8], [EV.breakstep - 0.05, EV.breakstep + 0.2, 6], [sceneT('break')[1] - 0.22, sceneT('break')[1], 6], [EV.quote - 0.02, EV.quote + 0.2, 6],
    [EV.snap - 0.02, EV.snap + 0.35, 6], [EV.tilt - 0.1, EV.tilt + 0.5, 6], [EV.pushes[3], EV.pushes[3] + 1.0, 6], ...EV.thumps.map(x => [x - 0.03, x + 0.15, 5]), ...EV.left.map(x => [x - 0.3, x + 0.02, 5]), [EV.allboots - 0.3, EV.allboots + 0.02, 5]];
  for (const w of win) if (t >= w[0] && t <= w[1]) return w[2];
  return 1;
}
function txt(ctx, s, x, y, size, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(o.sc || 1, o.sc || 1);
  ctx.font = `900 ${size}px ${o.font || 'Montserrat'}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const w = ctx.measureText(s).width, max = o.max || 960; if (w > max) { ctx.scale(max / w, max / w); }
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
  ctx.lineWidth = size * 0.17; ctx.strokeStyle = OUT; ctx.strokeText(s, 0, 0);
  ctx.shadowColor = 'transparent'; ctx.fillStyle = o.color || '#fff'; ctx.fillText(s, 0, 0);
  ctx.restore();
}
function overlays(ctx, t) {
  screen(ctx);
  // subtitles: pop-in with overshoot, 1-2 words, ~64% height
  for (const c of CHUNKS) if (t >= c.s - 0.015 && t < c.end) {
    const k = easeBack(inv(c.s - 0.02, c.s + 0.1, t)), wob = t > EV.what - 0.05 && t < EV.what + 0.9 ? Math.sin(t * 40) * 0.06 : 0;
    txt(ctx, c.text, W / 2, H * 0.70 - (1 - k) * 18, 98, { sc: 0.75 + 0.25 * k, rot: wob });
  }
  // kinetic "BREAK STEP!" — letters slam in on the yell
  const tb = EV.breakstep; if (t > tb - 0.04 && t < sceneT('break')[1]) {
    const words = ['BREAK', 'STEP!'];
    words.forEach((wd, i) => { const k = easeBack(inv(tb - 0.04 + i * 0.1, tb + 0.08 + i * 0.1, t)); if (k <= 0) return; txt(ctx, wd, W / 2 + (i ? 40 : -40), H * 0.36 + i * 190, 210, { sc: lerp(2.2, 1, k), rot: i ? 0.06 : -0.07, color: '#ffe066' }); });
  }
  // THUMP x3, each bigger
  EV.thumps.forEach((th, i) => { const k = t - th; if (k > -0.02 && k < 0.55) { const a = easeBack(inv(-0.02, 0.07, k)); ctx.globalAlpha = k > 0.4 ? 1 - (k - 0.4) / 0.15 : 1; txt(ctx, 'THUMP.', W / 2 + [-120, 110, 0][i], H * [0.3, 0.45, 0.62][i], 150 + i * 50, { sc: lerp(1.8, 1, a), rot: [-0.1, 0.08, -0.03][i] }); ctx.globalAlpha = 1; } });
  // post: look tint, vignette, grain
  const L = lookAt(t); if (L.tintA > 0.001) { ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = L.tintA * 3; ctx.fillStyle = L.tint; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
}
function post(ctx, t) {
  screen(ctx);
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,6,20,.38)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.045; const p = ctx.createPattern(GRAIN, 'repeat');
  p.setTransform(new DOMMatrix().translate((rnd(Math.floor(t * 60)) * 512) | 0, (rnd(Math.floor(t * 60) + 7) * 512) | 0)); ctx.fillStyle = p; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
window.renderAt = function (t) {
  const n = blurSamples(t), shutter = 1 / 60; // 360° shutter inside blur windows: stylised streaks
  if (n === 1) drawScene(CTX, t);
  else {
    for (let i = 0; i < n; i++) {
      const ts = t + (i / (n - 1) - 0.5) * shutter;
      BCTX.save(); drawScene(BCTX, sceneAt(ts)[0] === sceneAt(t)[0] ? ts : t); BCTX.restore();
      screen(CTX); CTX.globalAlpha = 1 / (i + 1); CTX.drawImage(BUF, 0, 0); CTX.globalAlpha = 1;
    }
  }
  post(CTX, t);
  overlays(CTX, t);
};
