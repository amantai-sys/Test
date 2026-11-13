// Scene direction. Every scene: draw(ctx, t, lt, u) where lt = local time, u = 0..1 progress.
let EV, TL, T0, BEAT;
const HERO = { coat: '#3f72dc', hat: 'bicorne', plume: '#3f72dc', epaulettes: true };
const RIVAL = { coat: '#d8423d', hat: 'bicorne', plume: '#d8423d', epaulettes: true, stache: 'handlebar' };
const BLUE = { coat: '#4a7be0', hat: 'shako', plume: '#f4f1ea', belts: true };
const RED = { coat: '#d8423d', hat: 'shako', plume: '#ffd34d', belts: true };
const marchPh = t => Math.PI * (t - T0) / BEAT;
const sceneT = id => { const i = EV.scenes.findIndex(s => s[0] === id); return [EV.scenes[i][1], i + 1 < EV.scenes.length ? EV.scenes[i + 1][1] : EV.total]; };

function lookAt(t) {
  const M = LOOKS.morning, G = LOOKS.golden, S = LOOKS.storm;
  if (t < 27.6) return M;
  if (t < 35.4) return mixLook(M, G, sstep(27.6, 28.6, t));
  if (t < sceneT('rules')[0]) return mixLook(G, S, sstep(35.4, 41.0, t));
  return G;
}
// bridge physics state by time
function bridgeAt(t) {
  const B = { amp: 0, osc: Math.cos(2 * Math.PI * (t - T0) / BEAT), tilt: 0, snapped: 0, shine: 0 };
  if (t > EV.thumps[0] - 0.05 && t < EV.hum) B.amp = 6 * pulse(t, EV.thumps[0], 0.03, 0.2) + 9 * pulse(t, EV.thumps[1], 0.03, 0.2) + 12 * pulse(t, EV.thumps[2], 0.03, 0.25);
  if (t >= EV.hum) B.amp = lerp(5, 22, sstep(EV.hum, EV.wobble[0], t)) + lerp(0, 34, sstep(EV.wobble[0], EV.wobble[1] + 0.4, t)) + lerp(0, 30, sstep(EV.wobble[1], EV.what, t));
  if (t >= EV.what) B.amp = 70 + 40 * sstep(sceneT('pushes')[0], EV.snap, t);
  if (t >= EV.snap) { B.snapped = easeOut((t - EV.snap) / 0.5); B.amp *= 1 - sstep(EV.snap, EV.tilt, t); }
  if (t >= EV.tilt - 0.05) B.tilt = 0.27 * easeBack((t - EV.tilt + 0.05) / 0.45);
  return B;
}
// the red block marching, ranks of 4. front = x of front rank. Drawn back-to-front.
function redBlock(ctx, t, B, front, o = {}) {
  const n = 74, ranks = Math.ceil(n / 4), sp = o.sp || 56, ph = marchPh(t);
  for (let k = 3; k >= 0; k--) {
    for (let r = ranks - 1; r >= 0; r--) {
      if (r * 4 + k >= n) continue;
      const x = front + r * sp + k * 9;
      const onDeck = x > X0 && x < X1;
      let gx = x, gy = 0, rot = 0;
      if (onDeck) { const d = deckPt(B, x); gx = d.x; gy = d.y; rot = d.a; }
      if (o.slide) { const sl = o.slide(r, k, gx, gy); gx = sl[0]; gy = sl[1]; rot = sl[2]; }
      guy(ctx, { ...RED, x: gx, y: gy - 6 - k * 7, s: 0.4 * (1 - k * 0.035), f: -1, gait: o.gait || 'march', ph: ph + (o.jitter ? rnd(r * 4 + k) * 3 : 0), mood: o.mood || 'smug', rot, chin: o.chin || 0, arms: o.arms, sweat: o.sweat, sweatT: t * 1.3 + r * 0.1 });
    }
  }
  if (o.captain !== false) {
    const x = front - 90; let gx = x, gy = 0, rot = 0; if (x > X0 && x < X1) { const d = deckPt(B, x); gx = d.x; gy = d.y; rot = d.a; }
    if (o.slide) { const sl = o.slide(-1.6, 0, gx, gy); gx = sl[0]; gy = sl[1]; rot = sl[2]; }
    guy(ctx, { ...RIVAL, x: gx, y: gy - 4, s: 0.46, f: -1, gait: o.gait || 'march', ph, mood: o.capMood || 'smug', rot, arms: o.capArms || 'swing', sweat: o.sweat, sweatT: t });
  }
}

const SCENES = {
  // 0 — cold open: captain in foreground, his men staggering onto the bridge
  open(ctx, t, lt, u) {
    const L = LOOKS.morning, B = { amp: 0, osc: 0 };
    const c = { x: lerp(-470, -330, easeIO(u)) + lt * 10, y: lerp(-240, -200, u), z: lerp(0.98, 1.16, easeIO(u)), r: -0.03 + u * 0.02 };
    drawValley(ctx, c, L, t, { dof: 0.6 });
    cam(ctx, c, 1);
    drawBridge(ctx, B, L, t, () => {
      for (let i = 0; i < 9; i++) {
        const x = -900 + i * 70 + lt * 55 + noise(i * 3 + lt) * 30; const onDeck = x > X0; const g = onDeck ? deckPt(B, x) : { x, y: 0, a: 0 };
        guy(ctx, { ...BLUE, x: g.x, y: g.y - (i % 2) * 8, s: 0.4, f: i === 4 ? -1 : 1, gait: 'stumble', ph: lt * 9 + i * 2, seed: i * 7, mood: i % 3 ? 'dizzy' : 'scared', arms: 'swing' });
      }
    });
    // bonk between two soldiers at ~1.6s
    if (lt > 1.4 && lt < 2.2) { cam(ctx, c, 1); ctx.save(); ctx.globalAlpha = 1 - inv(1.4, 2.2, lt); star(ctx, -540 + lt * 55, -190, 40 * easeBack(inv(1.4, 1.6, lt))); ctx.restore(); }
    // foreground captain (deeper layer => more parallax)
    cam(ctx, c, 1.22);
    guy(ctx, { ...HERO, x: -330, y: 250, s: 1.35, f: -1, mood: lt < 1.5 ? 'stern' : 'smug', arms: lt < 1.2 ? 'back' : 'point', gait: 'stand', chin: 0.05 });
    foreground(ctx, c, L, t, { y: 760, blur: 8 });
  },
  // 1 — 1831, parade ground, perfect step
  parade(ctx, t, lt, u) {
    const L = LOOKS.morning;
    const c = { x: lerp(-60, 40, u), y: lerp(-760, 120, easeIO(inv(0, 0.7, u))) + u * 30, z: lerp(1.0, 0.82, easeIO(u)), r: 0.0 };
    drawSky(ctx, L, c);
    cam(ctx, c, 0.2); for (let i = 0; i < 4; i++) cloud(ctx, -700 + i * 520 + lt * 20, -1500 + rnd(i) * 300, 0.9, L.cloud, L.cloudS);
    cam(ctx, c, 0.85);
    // barracks with year on pediment
    ctx.beginPath(); ctx.rect(-760, -820, 1520, 700); fill(ctx, '#e9dcc0'); paint(ctx, 0.3); ctx.beginPath(); ctx.rect(-760, -820, 1520, 700); stroke(ctx, 8);
    ctx.beginPath(); ctx.moveTo(-820, -820); ctx.lineTo(0, -1140); ctx.lineTo(820, -820); ctx.closePath(); fill(ctx, '#f3e8d0'); stroke(ctx, 8);
    ctx.font = '900 150px Baloo2'; ctx.textAlign = 'center'; ctx.fillStyle = '#7a5a3a'; ctx.fillText('1831', 0, -880);
    for (let i = 0; i < 7; i++) { const x = -660 + i * 220; ctx.beginPath(); ctx.rect(x - 28, -810, 56, 690); fill(ctx, '#fbf4e4'); ctx.fillStyle = '#d8c9a8'; ctx.fillRect(x + 6, -810, 22, 690); ctx.beginPath(); ctx.rect(x - 28, -810, 56, 690); stroke(ctx, 6); }
    // flag
    ctx.beginPath(); ctx.moveTo(0, -1140); ctx.lineTo(0, -1420); stroke(ctx, 8);
    ctx.beginPath(); ctx.moveTo(0, -1420); for (let k = 0; k <= 10; k++) ctx.lineTo(k * 22, -1420 + Math.sin(t * 6 - k * 0.6) * 10 * k / 10); for (let k = 10; k >= 0; k--) ctx.lineTo(k * 22, -1320 + Math.sin(t * 6 - k * 0.6) * 10 * k / 10); fill(ctx, '#3f72dc'); stroke(ctx, 5);
    // ground
    cam(ctx, c, 1);
    const gg = ctx.createLinearGradient(0, -140, 0, 1600); gg.addColorStop(0, '#d9c08a'); gg.addColorStop(1, '#e8d3a0');
    ctx.beginPath(); ctx.rect(-4000, -140, 8000, 5000); ctx.fillStyle = gg; ctx.fill(); paint(ctx, 0.35, 1.5);
    // 5 rows x 7 soldiers marching in place in perfect sync
    const ph = marchPh(t);
    for (let r = 0; r < 5; r++) {
      const y = -60 + r * 150, s = 0.42 + r * 0.09, sp = 150 + r * 34;
      for (let k = -3; k <= 3; k++) guy(ctx, { ...BLUE, x: k * sp + (r % 2) * 10, y, s, f: 1, gait: 'march', ph, mood: 'stern' });
    }
    // hero captain at front, proud
    guy(ctx, { ...HERO, x: 420 + Math.sin(lt) * 6, y: 780, s: 1.1, f: -1, mood: 'proud', arms: 'back', chin: 0.08 });
  },
  // 2 — boots close-ups: left, right, left; then a whole row in sync
  boots(ctx, t, lt) {
    const L = LOOKS.morning, [l0, r0, l1] = EV.left, all = EV.allboots;
    const ground = (c) => {
      drawSky(ctx, { skyT: '#8ccdf5', skyB: '#e3f4ff' }, c);
      blurred(ctx, 10, ctx => { cam(ctx, c, 0.4); ctx.beginPath(); ctx.rect(-3000, -500, 6000, 400); fill(ctx, '#e9dcc0'); for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.rect(-2400 + i * 400, -500, 60, 400); fill(ctx, '#fbf4e4'); } });
      cam(ctx, c, 1);
      ctx.beginPath(); ctx.rect(-4000, 0, 8000, 3000); fill(ctx, '#bfae8a');
      for (let r = 0; r < 14; r++) for (let k = -20; k < 20; k++) { const w = 120 + r * 18; ell(ctx, k * w + (r % 2) * w / 2, 30 + r * 70 + r * r * 4, w * 0.45, 26 + r * 3); fill(ctx, r % 3 ? '#cdbd98' : '#b7a580'); stroke(ctx, 4, '#8c7a58'); }
    };
    const stompY = (tt, t0) => { // boot height: lifted before t0, slams at t0
      const k = tt - t0; if (k < -0.32) return -260; if (k < 0) return -260 * (1 - easeIn((k + 0.32) / 0.32)); return -Math.max(0, kick(tt, t0, 30, 14)) * 18;
    };
    if (t < r0 - 0.05 || (t >= l1 - 0.05 && t < l1 + 0.3)) { // single left boot
      const tt = t < r0 - 0.05 ? l0 : l1; const [sx, sy] = shake(t, tt, 26, 0.35);
      const c = { x: 40 + (t - tt) * 30, y: -260, z: 1.0 + (t - tt) * 0.05, r: 0.05, sx, sy };
      ground(c); cam(ctx, c, 1); boot(ctx, -40, stompY(t, tt), 2.4, '#e9e4d8'); dust(ctx, 80, 0, t, tt, 2.2);
    } else if (t < l1 - 0.05) {
      const [sx, sy] = shake(t, r0, 26, 0.35);
      const c = { x: -40 - (t - r0) * 30, y: -260, z: 1.0 + (t - r0) * 0.05, r: -0.05, sx, sy };
      ground(c); cam(ctx, c, 1); boot(ctx, 40, stompY(t, r0), 2.4, '#e9e4d8', -1); dust(ctx, -80, 0, t, r0, 2.2);
    } else { // row of boots, all slamming on every beat, last slam on "same"
      const lt2 = t - l1 - 0.3, [sx, sy] = shake(t, all, 34, 0.5);
      const c = { x: lerp(-200, 200, sstep(0, 2.2, lt2)), y: -250, z: lerp(0.62, 0.7, lt2 / 2), r: 0.02, sx, sy };
      ground(c); cam(ctx, c, 1);
      const beats = [all - BEAT * 2, all - BEAT, all]; let tb = beats[0]; for (const b of beats) if (t > b - 0.3) tb = b;
      for (let k = -6; k <= 6; k++) { boot(ctx, k * 190 - 30, stompY(t, tb) * (k % 2 ? 1 : 1), 1.0, '#e9e4d8'); }
      for (const b of beats) dust(ctx, 0, 0, t, b, 3.4, 16);
    }
  },
  // 3 — the general, proud
  general(ctx, t, lt, u) {
    const c = { x: 0, y: -420, z: lerp(1.0, 1.15, easeIO(u)), r: lerp(0.04, 0.0, u) };
    drawSky(ctx, { skyT: '#ffb85c', skyB: '#ffe3a3' }, c);
    cam(ctx, c, 0.3); // sun rays
    for (let i = 0; i < 14; i++) { ctx.save(); ctx.rotate(i * Math.PI / 7 + lt * 0.2); ctx.beginPath(); ctx.moveTo(0, -1500); ctx.lineTo(-90, -3500); ctx.lineTo(90, -3500); ctx.closePath(); fill(ctx, 'rgba(255,255,255,.18)'); ctx.restore(); }
    blurred(ctx, 6, ctx => { cam(ctx, c, 0.7);
    ctx.beginPath(); ctx.moveTo(-500, -400); ctx.lineTo(-500, -1400); stroke(ctx, 14);
    ctx.beginPath(); ctx.moveTo(-500, -1400); for (let k = 0; k <= 12; k++) ctx.lineTo(-500 + k * 40, -1400 + Math.sin(t * 5 - k * 0.6) * 18 * k / 12); for (let k = 12; k >= 0; k--) ctx.lineTo(-500 + k * 40, -1150 + Math.sin(t * 5 - k * 0.6) * 18 * k / 12); fill(ctx, '#3f72dc'); stroke(ctx, 6);
    });
    cam(ctx, c, 1);
    guy(ctx, { coat: '#2f8f5a', hat: 'general', plume: '#d43c3c', stache: 'walrus', medals: true, epaulettes: true, glint: t * 7, x: 40, y: 380, s: 2.6, f: 1, mood: 'proud', chin: 0.12 + Math.sin(lt * 3) * 0.02, arms: 'back', legs: false });
  },
  // 4 — "Break step!": punch-in to the yelling mouth
  break(ctx, t, lt, u) {
    const L = LOOKS.morning, tb = EV.breakstep, d = sceneT('break')[1];
    const punch = easeIn(inv(tb, tb + 0.12, t)) * 0.25 + easeIn(inv(d - 0.2, d, t)) * 5;
    const [sx, sy] = shake(t, tb, 28, 0.5);
    const c = { x: -620 + lt * 8, y: -300, z: 1.0 + lt * 0.05, r: 0.02 };
    drawValley(ctx, c, L, t, { dof: 1.8 });
    blurred(ctx, 5, ctx => { cam(ctx, c, 1); drawBridge(ctx, { amp: 0, osc: 0 }, L, t); });
    const cc = { x: -900 + punch * 18, y: -330 - punch * 36, z: 1.0 + punch, r: 0, sx, sy };
    cam(ctx, cc, 1);
    guy(ctx, { ...HERO, x: -900, y: 200, s: 1.9, f: 1, mood: t > tb - 0.25 ? 'yell' : 'stern', mouth: Math.sin(t * 30) * 0.5 + 0.5, arms: t > tb - 0.2 ? 'up' : 'back', chin: t > tb ? 0.12 : 0 });
  },
  // 5 — establishing: brand-new chain bridge (iris opens out of the mouth)
  bridge(ctx, t, lt, u) {
    const L = LOOKS.morning, B = { amp: 0, osc: 0, shine: 1 };
    const c = { x: lerp(-200, 0, easeIO(u)), y: lerp(-700, -260, easeOut(u)), z: lerp(0.48, 0.58, easeIO(u)), r: lerp(-0.03, 0, u) };
    drawValley(ctx, c, L, t);
    cam(ctx, c, 1);
    drawBridge(ctx, B, L, t);
    // bunting between towers
    ctx.beginPath(); for (let x = -760; x <= 760; x += 20) { const y = -520 + 90 * (1 - (x / 760) ** 2); x === -760 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } stroke(ctx, 4);
    for (let x = -720; x <= 720; x += 60) { const y = -520 + 90 * (1 - (x / 760) ** 2); ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.lineTo(x, y + 40 + Math.sin(t * 6 + x) * 4); ctx.lineTo(x + 18, y); fill(ctx, ['#e8473d', '#ffd34d', '#3f72dc'][((x + 720) / 60) % 3]); }
    for (let i = 0; i < 12; i++) guy(ctx, { ...BLUE, x: -1500 + i * 60, y: 0, s: 0.4, f: 1, mood: 'neutral', gait: 'stand' });
    guy(ctx, { ...HERO, x: -1050, y: 0, s: 0.48, f: 1, mood: 'smug' });
    const ir = easeOut(inv(0, 0.35, lt)); // iris reveal from the dark mouth
    if (ir < 1) { screen(ctx); ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(W / 2, H / 2, ir * 1300, 0, Math.PI * 2, true); fill(ctx, '#3a1414'); ctx.restore(); }
  },
  // 6 — men stumble across like confused ducks
  ducks(ctx, t, lt, u) {
    const L = LOOKS.morning, B = { amp: 0, osc: 0 };
    const c = { x: lerp(-380, -140, easeIO(u)), y: -150, z: 1.08, r: 0.01 };
    drawValley(ctx, c, L, t, { dof: 1 });
    cam(ctx, c, 1);
    // a real duck below, judging
    const dq = EV.quack[1], q = pulse(t, dq, 0.03, 0.3);
    const dx = -260 + lt * 15, dy = 330 + Math.sin(t * 2) * 6;
    ctx.save(); ctx.translate(dx, dy); ctx.scale(-1.4, 1.4);
    ell(ctx, 0, 0, 60, 30); fill(ctx, '#fff7e6'); stroke(ctx, 6); ell(ctx, 36, -40, 26, 26); fill(ctx, '#fff7e6'); stroke(ctx, 6);
    ctx.beginPath(); ctx.moveTo(56, -44); ctx.lineTo(84 + q * 10, -40 - q * 10); ctx.lineTo(58, -34); ctx.lineTo(84 + q * 10, -28 + q * 10); ctx.lineTo(56, -30); fill(ctx, '#ff9a2e'); stroke(ctx, 4);
    ell(ctx, 42, -46, 4, 5); fill(ctx, OUT); ctx.restore();
    if (q > 0.2) { ctx.font = '900 64px Baloo2'; ctx.fillStyle = '#fff'; ctx.strokeStyle = OUT; ctx.lineWidth = 10; ctx.textAlign = 'center'; ctx.save(); ctx.translate(dx - 120, dy - 120); ctx.rotate(-0.2); ctx.scale(0.6 + q * 0.5, 0.6 + q * 0.5); ctx.strokeText('QUACK', 0, 0); ctx.fillText('QUACK', 0, 0); ctx.restore(); }
    drawBridge(ctx, B, L, t, () => {
      for (let i = 0; i < 11; i++) {
        const x = -690 + i * 66 + lt * 60 + noise(i * 5 + lt * 0.8) * 50 + (i === 6 ? -lt * 90 : 0); const g = deckPt(B, clamp(x, X0, X1));
        guy(ctx, { ...BLUE, x: g.x, y: g.y - (i % 3) * 7, s: 0.42, f: i === 6 ? -1 : 1, gait: 'stumble', ph: lt * 10 + i * 1.7, seed: i * 5, mood: ['dizzy', 'scared', 'shock'][i % 3], arms: i % 2 ? 'flail' : 'swing', rot: i === 3 ? Math.sin(lt * 4) * 0.3 : 0 });
      }
    });
    foreground(ctx, c, L, t, { y: 820 });
  },
  // 7 — whip-pan to the far bank, rival laughs, then the quote
  rival(ctx, t, lt, u) {
    const L = LOOKS.morning, q = EV.quote, wp = inv(EV.whip, EV.whip + 0.28, t);
    const qq = easeBack(inv(q, q + 0.18, t));
    const c = { x: lerp(-160, 1390, easeIO(wp)) + (t - q > 0 ? 0 : lt * 12), y: lerp(-160, -190, wp) - qq * 10, z: lerp(1.0, 1.15, wp) + qq * 0.85 + inv(q, sceneT('rival')[1], t) * 0.12, r: -0.02 * qq };
    drawValley(ctx, c, L, t, { dof: 1 + qq * 2 });
    cam(ctx, c, 1);
    drawBridge(ctx, { amp: 0, osc: 0 }, L, t, () => {
      for (let i = 0; i < 8; i++) { const x = -150 + i * 70 + noise(i * 5 + t) * 40; const g = deckPt({ amp: 0 }, x); guy(ctx, { ...BLUE, x: g.x, y: g.y, s: 0.42, f: 1, gait: 'stumble', ph: t * 10 + i * 1.7, seed: i * 5, mood: 'dizzy' }); }
    });
    // red ranks behind the rival, neat and smug
    for (let k = 3; k >= 0; k--) for (let r = 0; r < 9; r++) guy(ctx, { ...RED, x: 1520 + r * 62 + k * 10, y: -k * 8, s: 0.42 * (1 - k * 0.035), f: -1, mood: t > EV.whip + 0.5 ? 'laugh' : 'smug', gait: 'stand', lean: t > EV.whip + 0.5 ? Math.sin(t * 22 + r) * 0.05 : 0 });
    const laugh = t > EV.whip + 0.3 && t < q - 0.1;
    guy(ctx, { ...RIVAL, x: 1390, y: 10, s: 0.62, f: -1, mood: laugh ? 'laugh' : 'smug', arms: laugh ? 'hips' : 'point', cane: !laugh, lean: laugh ? Math.sin(t * 24) * 0.06 - 0.08 : 0 });
    foreground(ctx, c, L, t, { y: 840 });
  },
  // 8 — "But it gets weirder": dutch angle, calm hero
  weird(ctx, t, lt, u) {
    const L = mixLook(LOOKS.morning, LOOKS.storm, 0.25);
    const c = { x: -980 + lt * 30, y: -260, z: 1.55 + u * 0.12, r: -0.16 };
    drawValley(ctx, c, L, t * 3, { dof: 2 });
    cam(ctx, c, 1);
    guy(ctx, { ...HERO, x: -980, y: 150, s: 1.0, f: 1, mood: 'smug', arms: 'back', chin: 0.04 });
  },
  // 9 — one at a time, ten feet apart, on tiptoe
  tiptoe(ctx, t, lt, u) {
    const L = LOOKS.morning, B = { amp: 0, osc: 0 };
    const c = { x: lerp(-560, 120, easeIO(u)), y: -170, z: lerp(1.12, 0.92, easeIO(u)), r: 0 };
    drawValley(ctx, c, L, t, { dof: 1 });
    cam(ctx, c, 1);
    const sp = 230, head = -560 + lt * 75;
    drawBridge(ctx, B, L, t, () => {
      for (let i = 0; i < 7; i++) {
        const x = head - i * sp; if (x < -1300) continue; const g = x > X0 ? deckPt(B, x) : { x, y: 0, a: 0 };
        guy(ctx, { ...BLUE, x: g.x, y: g.y, s: 0.44, f: 1, gait: x > X0 - 40 ? 'tiptoe' : 'stand', ph: lt * 7 + i, mood: 'scared', arms: 'chest', sweat: i === 0, sweatT: t });
        if (i > 0 && x > X0 - 200 && u > 0.35) { // chalk measurement "10 FT"
          const a = clamp((u - 0.35) * 4); ctx.save(); ctx.globalAlpha = a;
          ctx.beginPath(); ctx.moveTo(g.x + 40, g.y - 200); ctx.lineTo(g.x + sp - 40, g.y - 200); stroke(ctx, 5, '#fff');
          ctx.beginPath(); ctx.moveTo(g.x + 40, g.y - 215); ctx.lineTo(g.x + 40, g.y - 185); ctx.moveTo(g.x + sp - 40, g.y - 215); ctx.lineTo(g.x + sp - 40, g.y - 185); stroke(ctx, 5, '#fff');
          ctx.font = '800 40px Baloo2'; ctx.textAlign = 'center'; ctx.lineWidth = 8; ctx.strokeStyle = OUT; ctx.strokeText('10 FT', g.x + sp / 2, g.y - 218); ctx.fillStyle = '#fff'; ctx.fillText('10 FT', g.x + sp / 2, g.y - 218); ctx.restore();
        }
      }
    });
    foreground(ctx, c, L, t, { y: 820 });
  },
  // 10 — the rival lines up 74 men (golden light) and marches onto the bridge
  march(ctx, t, lt, u) {
    const L = lookAt(t), B = bridgeAt(t), p2 = EV.scenes.find(s => s[0] === 'march')[1];
    const phase2 = t > TL.phrases[15].start - 0.05; // wide shot onto the bridge
    if (!phase2) { // dolly along the front line
      const chest = sstep(TL.phrases[14].start, TL.phrases[14].start + 0.25, t);
      const c = { x: lerp(1080, 1700, easeIO(inv(p2, TL.phrases[15].start, t))), y: -150, z: 2.0, r: 0.03 };
      drawValley(ctx, c, L, t, { dof: 2.5, sun: [-300, -900] });
      cam(ctx, c, 1);
      for (let k = 3; k >= 0; k--) for (let r = 0; r < 16; r++) guy(ctx, { ...RED, x: 1100 + r * 62 + k * 10, y: -k * 8, s: 0.42 * (1 - k * 0.035), f: -1, mood: chest > 0.5 ? 'proud' : 'smug', chin: chest * 0.14, gait: 'stand', arms: 'stiff' });
      guy(ctx, { ...RIVAL, x: 1010, y: 4, s: 0.5, f: 1, mood: 'smug', arms: 'hips', chin: 0.1 });
      foreground(ctx, c, L, t, { y: 700, blur: 10 });
    } else {
      const lt2 = t - TL.phrases[15].start;
      const c = { x: lerp(820, 380, easeIO(lt2 / 2.2)), y: -260, z: lerp(0.78, 0.66, lt2 / 2.2), r: -0.02 };
      drawValley(ctx, c, L, t, { sun: [-300, -900] });
      cam(ctx, c, 1);
      drawBridge(ctx, B, L, t, () => redBlock(ctx, t, B, 760 - lt2 * 110, {}));
      foreground(ctx, c, L, t, { y: 800 });
    }
  },
  // 11 — THUMP x3: deck-level, boots + giant type
  thump(ctx, t, lt, u) {
    const L = lookAt(t), B = bridgeAt(t);
    let [sx, sy] = [0, 0]; for (const th of EV.thumps) { const s = shake(t, th, 22, 0.4); sx += s[0]; sy += s[1]; }
    const c = { x: 420 - lt * 30, y: -140, z: 1.7 + lt * 0.06, r: 0.04, sx, sy };
    drawValley(ctx, c, L, t, { dof: 2.5, sun: [-300, -900] });
    cam(ctx, c, 1);
    drawBridge(ctx, B, L, t, () => redBlock(ctx, t, B, 520 - lt * 40, {}));
    for (const th of EV.thumps) { const d = deckPt(B, 520); dust(ctx, 520, d.y, t, th, 1.2, 10, '#e8c9a0'); }
  },
  // 12 — the bridge starts to hum: rivet close-up, then a widening wobble
  hum(ctx, t, lt, u) {
    const L = lookAt(t), B = bridgeAt(t);
    if (t < EV.wobble[0] - 0.1) { // macro: bolt vibrating
      const v = Math.sin(t * 90) * 3 * sstep(EV.hum, EV.hum + 0.6, t);
      const c = { x: 0 + lt * 6, y: -60, z: 1.0 + lt * 0.06, r: 0.08 };
      screen(ctx); const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, shade(L.skyT, -0.2)); g.addColorStop(1, L.skyB); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      cam(ctx, c, 1);
      ctx.beginPath(); ctx.moveTo(-40 + v, -2000); ctx.lineTo(-40 + v, -120); stroke(ctx, 40, '#2a2a33'); ctx.beginPath(); ctx.moveTo(-40 + v, -2000); ctx.lineTo(-40 + v, -120); stroke(ctx, 10, 'rgba(255,255,255,.25)');
      rr(ctx, -900, -140 + v * 0.5, 1800, 300, 20); fill(ctx, '#7a4a28'); paint(ctx, 0.45, 0.8); rr(ctx, -900, -140 + v * 0.5, 1800, 300, 20); stroke(ctx, 10);
      rr(ctx, -150 + v, -200, 220, 180, 26); fill(ctx, '#3a3a44'); stroke(ctx, 10);
      for (const bx of [-90, 10]) { ell(ctx, bx + v, -110, 34, 34); fill(ctx, '#8d8d99'); stroke(ctx, 8); ctx.beginPath(); ctx.moveTo(bx - 18 + v, -110); ctx.lineTo(bx + 18 + v, -110); stroke(ctx, 6); }
      ctx.save(); ctx.globalAlpha = 0.6; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(-40, -110, 120 + i * 60 + (lt * 200) % 60, -0.6, 0.6); stroke(ctx, 6, '#fff'); ctx.beginPath(); ctx.arc(-40, -110, 120 + i * 60 + (lt * 200) % 60, Math.PI - 0.6, Math.PI + 0.6); stroke(ctx, 6, '#fff'); } ctx.restore();
    } else {
      const c = { x: 60, y: -230, z: lerp(0.62, 0.56, u), r: Math.sin(t * 2) * 0.01 };
      drawValley(ctx, c, L, t, { sun: [-300, -900] });
      cam(ctx, c, 1);
      drawBridge(ctx, B, L, t, () => redBlock(ctx, t, B, 300 - lt * 30, { sweat: t > EV.wobble[1] }));
      // ripples under the deck
      ctx.save(); ctx.globalAlpha = 0.7; for (let i = 0; i < 4; i++) { const k = ((t * 1.6 + i / 4) % 1); ell(ctx, 0, 330, 200 + k * 700, 30 + k * 80); stroke(ctx, 5 * (1 - k), '#ffffff'); } ctx.restore();
      foreground(ctx, c, L, t, { y: 820 });
    }
  },
  // 13 — x-ray / blueprint: the bounce locks onto the beat
  xray(ctx, t, lt, u) {
    const B = bridgeAt(t), c = { x: 0, y: -200, z: 0.6 + u * 0.06, r: 0 };
    screen(ctx); ctx.fillStyle = '#123a7a'; ctx.fillRect(0, 0, W, H);
    cam(ctx, c, 1);
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2; for (let x = -2000; x <= 2000; x += 80) { ctx.beginPath(); ctx.moveTo(x, -3000); ctx.lineTo(x, 3000); ctx.stroke(); } for (let y = -3000; y <= 3000; y += 80) { ctx.beginPath(); ctx.moveTo(-2000, y); ctx.lineTo(2000, y); ctx.stroke(); }
    const WL = '#e9f4ff';
    for (const x of [-760, 760]) { ctx.beginPath(); ctx.rect(x - 60, -500, 120, 620); stroke(ctx, 5, WL); }
    ctx.beginPath(); for (let x = -760; x <= 760; x += 20) { const y = chainY(B, x); x === -760 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } stroke(ctx, 6, WL);
    ctx.beginPath(); for (let x = X0; x <= X1; x += 20) { const y = deckPt(B, x).y; x === X0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } stroke(ctx, 10, WL);
    // ghost envelope of the bounce
    ctx.save(); ctx.setLineDash([16, 14]); for (const sgn of [-1, 1]) { ctx.beginPath(); for (let x = X0; x <= X1; x += 20) { const y = sgn * B.amp * Math.sin(Math.PI * (x - X0) / (X1 - X0)); x === X0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } stroke(ctx, 4, '#7fd0ff'); } ctx.restore();
    // step pulses: red dots on each beat travelling down
    const ph = (t - T0) / BEAT, fr = ph - Math.floor(ph);
    for (let i = 0; i < 12; i++) { const x = -520 + i * 95, d = deckPt(B, x); ell(ctx, x, d.y - 40, 14, 14); fill(ctx, fr < 0.25 ? '#ff5a4a' : '#ff5a4a66'); if (fr < 0.25) { ctx.beginPath(); ctx.moveTo(x, d.y - 120 + fr * 200); ctx.lineTo(x, d.y - 60 + fr * 200); stroke(ctx, 8, '#ff5a4a'); ctx.beginPath(); ctx.moveTo(x - 14, d.y - 74 + fr * 200); ctx.lineTo(x, d.y - 56 + fr * 200); ctx.lineTo(x + 14, d.y - 74 + fr * 200); stroke(ctx, 8, '#ff5a4a'); } }
    // two waveforms syncing up
    const gy = 520, lock = sstep(0.1, 0.8, u);
    ctx.font = '800 54px Baloo2'; ctx.textAlign = 'left'; ctx.fillStyle = '#7fd0ff'; ctx.fillText('BRIDGE BOUNCE', -700, gy - 90); ctx.fillStyle = '#ff7a6a'; ctx.fillText('MARCHING BEAT', -700, gy + 230);
    ctx.beginPath(); for (let x = -700; x <= 700; x += 8) { const y = gy + Math.cos(2 * Math.PI * ((x + 700) / 300 - ph)) * (30 + 50 * lock); x === -700 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } stroke(ctx, 8, '#7fd0ff');
    for (let x = -700; x <= 700; x += 300) { const xx = x + ((1 - lock) * 90 * Math.sin(ph * 0.7)) - fr * 0; ctx.beginPath(); ctx.moveTo(xx + fr * 0, gy + 170); ctx.lineTo(xx, gy + 110); stroke(ctx, 10, '#ff7a6a'); }
  },
  // 14 — "Wait, what?" rival's shock on the bridge
  what(ctx, t, lt, u) {
    const L = lookAt(t), B = bridgeAt(t), [sx, sy] = shake(t, EV.what, 10, 0.3);
    const c = { x: -280, y: -150 + deckPt(B, -200).y * 0.6, z: 2.6 + u * 0.4, r: 0.12, sx, sy };
    drawValley(ctx, c, L, t, { dof: 3, sun: [-300, -900] });
    cam(ctx, c, 1);
    drawBridge(ctx, B, L, t, () => redBlock(ctx, t, B, -190, { capMood: 'shock', capArms: 'up', mood: 'scared', sweat: true }));
  },
  // 15 — natural bounce → match-cut to a guitar string
  string(ctx, t, lt, u) {
    const tp = EV.pluck, mc = tp - 0.55; // match cut moment
    if (t < mc) {
      const L = lookAt(t), B = { amp: 36, osc: Math.sin((t - sceneT('string')[0]) * 7), tilt: 0 };
      const c = { x: 0, y: -60, z: lerp(0.6, 0.78, easeIO(inv(sceneT('string')[0], mc, t))), r: 0 };
      drawValley(ctx, c, L, t, { sun: [-300, -900] });
      cam(ctx, c, 1); drawBridge(ctx, B, L, t);
      ctx.save(); ctx.setLineDash([18, 14]); for (const sgn of [-1, 1]) { ctx.beginPath(); for (let x = X0; x <= X1; x += 20) { const y = 15 + sgn * 36 * Math.sin(Math.PI * (x - X0) / 1400); x === X0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } stroke(ctx, 6, '#ffffff'); } ctx.restore();
    } else {
      const c = { x: 0, y: 0, z: 0.78 + (t - mc) * 0.05, r: 0 };
      screen(ctx); ctx.fillStyle = '#2b1a12'; ctx.fillRect(0, 0, W, H);
      cam(ctx, c, 1);
      ell(ctx, 0, 0, 1300, 1500); fill(ctx, '#e8a35a'); paint(ctx, 0.45, 2); ell(ctx, 0, 0, 1300, 1500); stroke(ctx, 14);
      ell(ctx, 0, -560, 300, 300); fill(ctx, '#1a0e08'); stroke(ctx, 30, '#c9783a');
      rr(ctx, -760, -40, 1520, 80, 10); fill(ctx, '#6b3a1c'); stroke(ctx, 8);
      const a = t < tp ? -38 * sstep(mc, tp - 0.05, t) : 60 * Math.exp(-(t - tp) * 1.6) * Math.cos((t - tp) * 48);
      for (let s = 0; s < 6; s++) {
        const yy = -200 + s * 90 - 200, isMain = s === 3;
        ctx.beginPath(); for (let x = -720; x <= 720; x += 12) { const y = yy + (isMain ? a * Math.sin(Math.PI * (x + 720) / 1440) : 0); x === -720 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        stroke(ctx, isMain ? 12 : 6, '#e9e5dc');
      }
      if (t < tp + 0.1) { const fx = 40, fy = 70 - 200 - 38 * sstep(mc, tp - 0.05, t) + 30; ctx.beginPath(); ctx.moveTo(fx + 260, fy + 900); ctx.lineTo(fx + 30, fy + 40); stroke(ctx, 18); ell(ctx, fx + 22, fy + 30, 22, 22); fill(ctx, '#f7f0e1'); stroke(ctx, 8); }
      if (t > tp) { ctx.save(); ctx.globalAlpha = Math.exp(-(t - tp) * 2); for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 70, 100 + i * 120 + (t - tp) * 300, 0, Math.PI * 2); stroke(ctx, 6, '#fff3d0'); } ctx.restore(); }
    }
  },
  // 16 — pushing a kid on a swing
  swing(ctx, t, lt, u) {
    const L = LOOKS.morning, P = EV.pushes;
    let amp = 0.18; P.forEach((p, i) => amp += sstep(p, p + 0.3, t) * [0.18, 0.22, 0.35, 0.6][i]);
    const loop = sstep(P[3] + 0.1, P[3] + 0.6, t); // last: full loop-the-loop
    const ang = loop > 0 ? lerp(Math.sin((t - P[0]) * 4.2) * Math.min(amp, 1.3), Math.PI * 2 * easeIO(inv(P[3] + 0.1, P[3] + 0.9, t)) + 0.9, loop) : Math.sin((t - sceneT('swing')[0]) * 4.2 + 1) * Math.min(amp, 1.3);
    const c = { x: -40 + Math.sin(ang) * 60, y: -470 - loop * 120, z: 0.8 - loop * 0.12, r: 0 };
    drawValley(ctx, c, L, t, { dof: 1 });
    cam(ctx, c, 1);
    // tree + branch
    ctx.beginPath(); ctx.moveTo(-700, 200); ctx.lineTo(-640, -1300); ctx.lineTo(-560, -1300); ctx.lineTo(-520, 200); fill(ctx, '#6b4426'); stroke(ctx, 10);
    ctx.beginPath(); ctx.moveTo(-600, -1220); ctx.quadraticCurveTo(0, -1290, 520, -1220); stroke(ctx, 50, '#6b4426'); ctx.beginPath(); ctx.moveTo(-600, -1220); ctx.quadraticCurveTo(0, -1290, 520, -1220); stroke(ctx, 6);
    for (let i = 0; i < 6; i++) { ell(ctx, -700 + i * 260, -1360 + (i % 2) * 70, 260, 170); fill(ctx, i % 2 ? '#4f9a46' : '#5fae52'); stroke(ctx, 7); }
    const px = -120, py = -1230, len = 820;
    const sx = px + Math.sin(ang) * len, sy = py + Math.cos(ang) * len;
    ctx.beginPath(); ctx.moveTo(px - 40, py); ctx.lineTo(sx - 40, sy); ctx.moveTo(px + 40, py); ctx.lineTo(sx + 40, sy); stroke(ctx, 6, '#3a2618');
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(-ang);
    rr(ctx, -80, -10, 160, 26, 8); fill(ctx, '#a0602c'); stroke(ctx, 6);
    guy(ctx, { coat: '#ff7a8a', hat: 'cap', x: 0, y: 70, s: 0.85, f: 1, mood: loop > 0.3 ? 'shock' : 'happy', arms: 'up', legs: true });
    ctx.restore();
    // hero captain pushing (cameo), pushes on cue
    let push = 0; P.forEach(p => push = Math.max(push, pulse(t, p, 0.08, 0.25)));
    guy(ctx, { ...HERO, x: -300 + push * 40, y: -60, s: 1.0, f: 1, mood: 'happy', arms: push > 0.3 ? 'push' : 'swing', gait: 'stand', hat: 'bicorne' });
    P.forEach(p => { const k = t - p; if (k > 0 && k < 0.4) { ctx.save(); ctx.globalAlpha = 1 - k / 0.4; ctx.font = '900 70px Baloo2'; ctx.textAlign = 'center'; ctx.lineWidth = 12; ctx.strokeStyle = OUT; ctx.strokeText('PUSH!', -200, -300 - k * 200); ctx.fillStyle = '#fff'; ctx.fillText('PUSH!', -200, -300 - k * 200); ctx.restore(); } });
  },
  // 17 — 74 perfectly timed pushes: every footfall shoots an arrow into the deck
  pushes(ctx, t, lt, u) {
    const L = lookAt(t), B = bridgeAt(t);
    const c = { x: lerp(-100, 0, u), y: lerp(-120, -220, u), z: lerp(0.95, 0.66, easeIO(u)), r: Math.sin(t * 3) * 0.015 };
    drawValley(ctx, c, L, t, { sun: [-300, -900] });
    cam(ctx, c, 1);
    drawBridge(ctx, B, L, t, () => {
      redBlock(ctx, t, B, -520 + lt * 20, { sweat: true, mood: 'scared' });
      const ph = (t - T0) / BEAT, fr = ph - Math.floor(ph);
      if (fr < 0.35) for (let r = 0; r < 19; r += 2) { const x = -520 + lt * 20 + r * 56, d = deckPt(B, x); ctx.save(); ctx.globalAlpha = 1 - fr / 0.35; ctx.beginPath(); ctx.moveTo(x, d.y + 10 + fr * 120); ctx.lineTo(x, d.y + 90 + fr * 120); stroke(ctx, 12, '#ffd34d'); ctx.beginPath(); ctx.moveTo(x - 20, d.y + 66 + fr * 120); ctx.lineTo(x, d.y + 94 + fr * 120); ctx.lineTo(x + 20, d.y + 66 + fr * 120); stroke(ctx, 12, '#ffd34d'); ctx.restore(); }
    });
    // counter: "74"
    screen(ctx); const k = easeBack(inv(TL.phrases[24].start + 1.6, TL.phrases[24].start + 1.9, t));
    if (k > 0) { ctx.save(); ctx.translate(W / 2, 470); ctx.scale(k, k); ctx.rotate(-0.06); ctx.font = '900 260px Montserrat'; ctx.textAlign = 'center'; ctx.lineWidth = 26; ctx.strokeStyle = OUT; ctx.strokeText('×74', 0, 0); ctx.fillStyle = '#ffd34d'; ctx.fillText('×74', 0, 0); ctx.restore(); }
  },
  // 18 — the bolt snaps, the deck tilts
  snap(ctx, t, lt, u) {
    const L = lookAt(t), B = bridgeAt(t);
    if (t < EV.tilt - 0.32) {
      const k = t - EV.snap, [sx, sy] = shake(t, EV.snap, 30, 0.4);
      const c = { x: 0, y: -60, z: 1.25 + lt * 0.08, r: -0.1, sx, sy };
      screen(ctx); ctx.fillStyle = shade(L.skyT, -0.1); ctx.fillRect(0, 0, W, H);
      cam(ctx, c, 1);
      const v = k < 0 ? Math.sin(t * 120) * 6 : 0;
      ctx.beginPath(); ctx.moveTo(-40 + v, -2000); ctx.lineTo(-40 + v + (k > 0 ? k * 300 : 0), -120 - (k > 0 ? k * 500 : 0)); stroke(ctx, 40, '#2a2a33');
      rr(ctx, -900, -140, 1800, 300, 20); fill(ctx, '#7a4a28'); paint(ctx, 0.45, 0.8); rr(ctx, -900, -140, 1800, 300, 20); stroke(ctx, 10);
      rr(ctx, -150 + v, -200, 220, 180, 26); fill(ctx, '#3a3a44'); stroke(ctx, 10);
      ell(ctx, -90 + v, -110, 34, 34); fill(ctx, '#8d8d99'); stroke(ctx, 8);
      // the bolt flying out, spinning
      const bx = 10 + (k > 0 ? k * 1800 : v), by = -110 - (k > 0 ? k * 900 - k * k * 1200 : 0);
      ctx.save(); ctx.translate(bx, by); ctx.rotate(k > 0 ? k * 30 : 0); rr(ctx, -16, -90, 32, 180, 8); fill(ctx, '#a9a9b5'); stroke(ctx, 7); ell(ctx, 0, -90, 40, 20); fill(ctx, '#8d8d99'); stroke(ctx, 7); ctx.restore();
      if (k > 0 && k < 0.35) for (let i = 0; i < 16; i++) { const a = rnd(i) * Math.PI * 2, r = k * (600 + rnd(i + 4) * 600); ctx.beginPath(); ctx.moveTo(10 + Math.cos(a) * r * 0.6, -110 + Math.sin(a) * r * 0.6); ctx.lineTo(10 + Math.cos(a) * r, -110 + Math.sin(a) * r); stroke(ctx, 8, '#ffd34d'); }
      if (k > -0.02 && k < 0.08) { screen(ctx); ctx.fillStyle = 'rgba(255,240,200,.35)'; ctx.fillRect(0, 0, W, H); }
    } else {
      const [sx, sy] = shake(t, EV.tilt, 40, 0.6);
      const c = { x: 120, y: -120, z: 0.62, r: -0.12 * sstep(EV.tilt - 0.3, EV.tilt + 0.3, t), sx, sy };
      drawValley(ctx, c, L, t, { sun: [-300, -900] });
      cam(ctx, c, 1);
      drawBridge(ctx, B, L, t, () => redBlock(ctx, t, B, -480, { mood: 'shock', capMood: 'shock', capArms: 'up', arms: 'up', gait: 'march' }));
    }
  },
  // 19 — slide into the river, still in step
  river(ctx, t, lt, u) {
    const L = lookAt(t), B = { amp: 0, osc: 0, tilt: 0.27, snapped: 1 }, st = EV.still;
    if (t < st - 0.05) {
      const c = { x: lerp(160, 420, easeIO(u * 1.4)), y: lerp(-80, 60, u * 1.4), z: lerp(0.62, 0.7, u), r: -0.06 };
      drawValley(ctx, c, L, t, { sun: [-300, -900] });
      cam(ctx, c, 1);
      const slideStart = TL.words.find(w => w.p === 26 && w.w === 'slide').s - 0.6;
      drawBridge(ctx, B, L, t, () => redBlock(ctx, t, B, -480, {
        mood: 'shock', capMood: 'shock', capArms: 'up', slide: (r, k, gx, gy) => {
          const d0 = -480 + r * 56 + k * 9; const s = Math.max(0, t - slideStart - (18 - r) * 0.04);
          const along = d0 + s * s * 420; const d = deckPt(B, Math.min(along, X1)); const over = Math.max(0, along - X1);
          return [d.x + over * 0.6, d.y + over * over * 0.004 + over * 0.3, 0.27];
        }
      }));
      waterFront(ctx, L, t, 235);
      for (let i = 0; i < 6; i++) splash(ctx, 560 + i * 60, 236, t, slideStart + 0.75 + i * 0.22, 1.2);
      foreground(ctx, c, L, t, { y: 880 });
    } else { // heads bobbing in the river, in perfect step
      const c = { x: 0, y: 120, z: 1.5 + (t - st) * 0.08, r: 0.02 };
      drawValley(ctx, c, L, t, { dof: 2.5, sun: [-300, -900] });
      cam(ctx, c, 1);
      const ph = marchPh(t);
      for (let i = 0; i < 9; i++) {
        const x = -420 + i * 110 + (i % 2) * 20, b = Math.sin(ph + (i % 2) * Math.PI) * 10;
        guy(ctx, { ...RED, x, y: 330 + b + (i % 3) * 20, s: 0.62, f: -1, mood: 'stern', gait: 'march', ph, legs: false, arms: 'swing' });
      }
      guy(ctx, { ...RIVAL, x: 40, y: 380 + Math.sin(ph) * 10, s: 0.7, f: -1, mood: 'stern', stache: 'droop', legs: false, arms: 'swing' });
      waterFront(ctx, L, t, 250);
      ell(ctx, 360 + (t - st) * 30, 248, 40, 12); fill(ctx, '#1d2140'); ell(ctx, 360 + (t - st) * 30, 228, 15, 20); fill(ctx, '#ffd34d'); stroke(ctx, 4); // floating shako plume
    }
  },
  // 20 — new rule, stamped
  rules(ctx, t, lt, u) {
    const L = LOOKS.golden, ts = EV.stamp, [sx, sy] = shake(t, ts, 22, 0.4);
    const c = { x: lerp(-260, -110, easeIO(u)), y: lerp(-150, -330, easeIO(u)), z: lerp(0.95, 1.3, easeIO(u)), r: 0.02, sx, sy };
    drawValley(ctx, c, L, t, { dof: 2, sun: [-300, -900] });
    blurred(ctx, 3, ctx => { cam(ctx, c, 1); drawBridge(ctx, { amp: 0, osc: 0 }, L, t, () => { for (let i = 0; i < 6; i++) { const x = -500 + i * 200 + lt * 50, d = deckPt({}, x); guy(ctx, { ...BLUE, x: d.x, y: d.y, s: 0.42, f: 1, gait: 'stumble', ph: lt * 8 + i, seed: i, mood: 'happy' }); } }); });
    cam(ctx, c, 1);
    // notice board on a post
    ctx.beginPath(); ctx.rect(-130, -300, 26, 600); fill(ctx, '#6b4426'); stroke(ctx, 6);
    rr(ctx, -420, -720, 620, 440, 14); fill(ctx, '#8a5a32'); stroke(ctx, 8);
    rr(ctx, -380, -690, 540, 380, 6); fill(ctx, '#f6ecd2'); paint(ctx, 0.3); rr(ctx, -380, -690, 540, 380, 6); stroke(ctx, 5);
    ctx.textAlign = 'center'; ctx.fillStyle = '#3a2618'; ctx.font = '800 52px Baloo2'; ctx.fillText('BY ORDER', -110, -620);
    ctx.font = '700 36px Baloo2'; ['ALL TROOPS SHALL', 'BREAK STEP', 'ON BRIDGES'].forEach((s2, i) => ctx.fillText(s2, -110, -560 + i * 50));
    const sk = easeOut(inv(ts - 0.12, ts, t)); if (t > ts - 0.12) { ctx.save(); ctx.translate(-20, -380); ctx.rotate(-0.18); const sc = lerp(2.4, 1, sk); ctx.scale(sc, sc); ctx.globalAlpha = sk; rr(ctx, -150, -46, 300, 92, 12); stroke(ctx, 10, '#d8423d'); ctx.font = '900 54px Montserrat'; ctx.fillStyle = '#d8423d'; ctx.fillText('APPROVED', 0, 18); ctx.restore(); }
    guy(ctx, { ...HERO, x: 380 - lt * 40, y: 200, s: 0.9, f: -1, mood: 'smug', gait: 'walk', ph: lt * 6, arms: 'back' });
    foreground(ctx, c, L, t, { y: 760 });
  },
  // 21 — night, the rival dries everything by the fire (hard cut mid-sentence)
  fire(ctx, t, lt, u) {
    const L = LOOKS.night;
    const c = { x: lerp(-160, -40, u), y: lerp(-260, -300, u), z: lerp(1.0, 1.3, easeIO(u)), r: 0.0 };
    drawValley(ctx, c, L, t, { night: true, sun: [380, -1400], dof: 1.5 });
    cam(ctx, c, 1);
    // fire glow
    const fl = 0.85 + noise(t * 9) * 0.15;
    const gg = ctx.createRadialGradient(-260, 120, 20, -260, 120, 900 * fl); gg.addColorStop(0, 'rgba(255,170,70,.65)'); gg.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = gg; ctx.fillRect(-1400, -900, 2400, 2000);
    // laundry line with dripping uniform
    ctx.beginPath(); ctx.moveTo(-800, -380); ctx.quadraticCurveTo(0, -300, 700, -380); stroke(ctx, 4, '#c9c0b0');
    capsule(ctx, 120, -350, -150, 70); fill(ctx, '#d8423d'); stroke(ctx, 7); ctx.beginPath(); ctx.moveTo(60, -330); ctx.lineTo(180, -170); ctx.moveTo(180, -330); ctx.lineTo(60, -170); stroke(ctx, 10, '#f4efe4');
    for (let i = 0; i < 4; i++) { const k = (t * 1.3 + i * 0.27) % 1; ell(ctx, 80 + i * 26, -150 + k * 260, 6, 9); fill(ctx, '#7fd0ff'); }
    ctx.beginPath(); ctx.moveTo(-320, -360); ctx.lineTo(-300, -300); ctx.lineTo(-280, -360); stroke(ctx, 4);
    // fire + logs + boots on a stick
    for (const a of [-0.3, 0.3]) { ctx.save(); ctx.translate(-260, 160); ctx.rotate(a); rr(ctx, -120, -18, 240, 36, 16); fill(ctx, '#5a3a20'); stroke(ctx, 6); ctx.restore(); }
    for (let i = 0; i < 3; i++) { const h = (120 + i * 40) * (0.85 + noise(t * 8 + i * 3) * 0.2); ctx.beginPath(); ctx.moveTo(-320 + i * 30, 150); ctx.quadraticCurveTo(-330 + i * 40, 150 - h * 0.6, -260 + noise(t * 6 + i) * 20, 150 - h); ctx.quadraticCurveTo(-200 - i * 30, 150 - h * 0.6, -200 - i * 20, 150); fill(ctx, ['#ff6a2a', '#ffa83a', '#ffe17a'][i]); }
    ctx.beginPath(); ctx.moveTo(-560, 60); ctx.lineTo(-20, -60); stroke(ctx, 10, '#6b4426');
    for (const bx of [-330, -200]) { ctx.save(); ctx.translate(bx, -60 + (bx + 560) * -0.22 + 70); ctx.rotate(Math.PI); boot(ctx, 0, 0, 0.35, '#d8423d'); ctx.restore(); }
    for (let i = 0; i < 5; i++) { const k = (t * 0.7 + i / 5) % 1; ctx.save(); ctx.globalAlpha = 0.5 * (1 - k); ell(ctx, -260 + noise(i + t) * 40, -80 - k * 500, 30 + k * 50, 24 + k * 40); fill(ctx, '#9a9ab8'); ctx.restore(); }
    // rival in long johns, purple with rage, steaming
    guy(ctx, { coat: '#f1e6cf', bare: true, hat: 'wet', stache: 'droop', x: 120, y: 230, s: 1.0, f: -1, mood: 'angry', steam: true, steamT: t, arms: 'hips', gait: 'stand', lean: Math.sin(t * 30) * 0.01 });
    // warm rim light from the fire
    screen(ctx); ctx.fillStyle = 'rgba(255,140,60,.06)'; ctx.fillRect(0, 0, W, H);
  },
};
