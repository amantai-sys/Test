// Timeline, subtitles, kinetic type and post FX (2D layer on top of the 3D frame).
let CTX, CHUNKS = [], EV, TL, BEAT;
function mixHex(a, b, t) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const c = i => Math.round(lerp((pa >> i) & 255, (pb >> i) & 255, t)); return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1); }
function init(timeline, events) {
  TL = timeline; EV = events; BEAT = EV.beat; makeTextures();
  const cv = document.getElementById('c'); cv.width = W; cv.height = H; CTX = cv.getContext('2d');
  const words = TL.words;
  for (let i = 0; i < words.length; i++) {
    const a = words[i], b = words[i + 1], clean = s => s.replace(/["“”]/g, '');
    if (b && b.p === a.p && !/[.,?!]$/.test(clean(a.w)) && (clean(a.w) + ' ' + clean(b.w)).length <= 11) { CHUNKS.push({ text: clean(a.w) + ' ' + clean(b.w), s: a.s, e: b.e }); i++; }
    else CHUNKS.push({ text: clean(a.w), s: a.s, e: a.e });
  }
  for (let i = 0; i < CHUNKS.length; i++) { const n = CHUNKS[i + 1]; CHUNKS[i].end = n && n.s - CHUNKS[i].e < 0.5 ? n.s - 0.025 : Math.min(CHUNKS[i].e + 0.25, n ? n.s - 0.025 : 1e9); }
}
function sceneAt(t) { let s = EV.scenes[0]; for (const x of EV.scenes) if (t >= x[1]) s = x; return s; }
function sceneT(id) { const i = EV.scenes.findIndex(s => s[0] === id); return [EV.scenes[i][1], i + 1 < EV.scenes.length ? EV.scenes[i + 1][1] : EV.total]; }
function txt(ctx, s, x, y, size, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(o.sc || 1, o.sc || 1);
  ctx.font = `900 ${size}px ${o.font || 'Montserrat'}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const w = ctx.measureText(s).width, max = o.max || 960; if (w > max) ctx.scale(max / w, max / w);
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8; ctx.lineWidth = size * 0.17; ctx.strokeStyle = OUT; ctx.strokeText(s, 0, 0);
  ctx.shadowColor = 'transparent'; ctx.fillStyle = o.color || '#fff'; ctx.fillText(s, 0, 0); ctx.restore();
}
function overlays(ctx, t) {
  screen(ctx);
  for (const c of CHUNKS) if (t >= c.s - 0.015 && t < c.end) {
    const k = easeBack(inv(c.s - 0.02, c.s + 0.1, t)), wob = t > EV.what - 0.05 && t < EV.what + 0.6 ? Math.sin(t * 40) * 0.06 : 0;
    txt(ctx, c.text, W / 2, H * 0.70 - (1 - k) * 18, 98, { sc: 0.75 + 0.25 * k, rot: wob });
  }
  EV.pssh.forEach((th, i) => { const k = t - th; if (k > -0.02 && k < 0.48) { const a = easeBack(inv(-0.02, 0.07, k)); ctx.globalAlpha = k > 0.34 ? 1 - (k - 0.34) / 0.14 : 1; txt(ctx, 'PSSHH!', W / 2 + [-110, 120, 0][i], H * [0.28, 0.42, 0.56][i], 140 + i * 45, { sc: lerp(1.8, 1, a), rot: [-0.1, 0.08, -0.04][i] }); ctx.globalAlpha = 1; } });
}
function post(ctx, t) {
  screen(ctx);
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,6,20,.36)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.045; const p = ctx.createPattern(GRAIN, 'repeat');
  p.setTransform(new DOMMatrix().translate((rnd(Math.floor(t * 60)) * 512) | 0, (rnd(Math.floor(t * 60) + 7) * 512) | 0)); ctx.fillStyle = p; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
