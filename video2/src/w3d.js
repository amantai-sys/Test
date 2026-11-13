// "Why Airplane Windows Are Round": 3D sets (Three.js) + 2D characters as billboards.
// Rule of this film: characters are always drawn whole (no isolated limbs), and the camera is always moving.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), C = c => new THREE.Color(c);
let renderer, composer, renderPass, bokeh, GL;
const camera = new THREE.PerspectiveCamera(38, W / H, 5, 80000);
const SC = {};
let GRAD, BRUSHTEX, METALTEX, WAVETEX, BLOB, CONCRETE;

// ---------------- materials ----------------
function canvasTex(w, h, f, rep = [1, 1]) { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function strokes(g, w, h, base, lo, hi, n, lw) { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < n; i++) { const x = rnd(i) * w, y = rnd(i + 99) * h, l = 10 + rnd(i + 5) * 50, a = (rnd(i + 7) - 0.5) * 0.9, v = Math.floor(lo + rnd(i + 3) * (hi - lo)); g.strokeStyle = `rgba(${v},${v},${v},0.5)`; g.lineWidth = lw * (0.5 + rnd(i + 11)); g.lineCap = 'round'; for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l); g.stroke(); } } }
function makeTex() {
  const g = new Uint8Array([80, 160, 255]); GRAD = new THREE.DataTexture(g, 3, 1, THREE.RedFormat); GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;
  BRUSHTEX = canvasTex(512, 512, (c, w, h) => strokes(c, w, h, '#e6e6e6', 200, 255, 1600, 8));
  METALTEX = canvasTex(512, 512, (c, w, h) => { strokes(c, w, h, '#ececec', 215, 255, 700, 6); c.fillStyle = '#9a9a9a'; for (let y = 16; y < h; y += 64) for (let x = 16; x < w; x += 32) { c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill(); } c.strokeStyle = '#a8a8a8'; c.lineWidth = 3; for (let y = 0; y < h; y += 128) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } });
  CONCRETE = canvasTex(512, 512, (c, w, h) => { strokes(c, w, h, '#e2e2e2', 195, 245, 900, 6); c.strokeStyle = '#a0a0a0'; c.lineWidth = 4; for (let x = 0; x < w; x += 256) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); c.beginPath(); c.moveTo(0, x); c.lineTo(w, x); c.stroke(); } });
  WAVETEX = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#d6d6d6'; c.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { const x = rnd(i) * w, y = rnd(i + 5) * h, l = 30 + rnd(i + 2) * 60; c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - l, y); c.quadraticCurveTo(x, y - 10, x + l, y); c.stroke(); } });
  BLOB = canvasTex(128, 128, (c) => { const r = c.createRadialGradient(64, 64, 4, 64, 64, 62); r.addColorStop(0, 'rgba(0,0,0,.5)'); r.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = r; c.fillRect(0, 0, 128, 128); });
}
const toon = (color, map, rep) => { const m = new THREE.MeshToonMaterial({ color, gradientMap: GRAD }); if (map) { m.map = map.clone(); m.map.needsUpdate = true; if (rep) m.map.repeat.set(rep[0], rep[1]); } return m; };
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x14110f, side: THREE.BackSide });
function outline(m, w = 4) { const o = new THREE.Mesh(m.geometry, OUTLINE); const g = m.geometry; g.computeBoundingBox(); const s = g.boundingBox.getSize(V(0, 0, 0)); o.scale.set((s.x + 2 * w) / Math.max(s.x, 1e-3), (s.y + 2 * w) / Math.max(s.y, 1e-3), (s.z + 2 * w) / Math.max(s.z, 1e-3)); const c = g.boundingBox.getCenter(V(0, 0, 0)); o.position.copy(c).multiply(V(1 - o.scale.x, 1 - o.scale.y, 1 - o.scale.z)); m.add(o); return m; }
function mesh(geo, mat, x = 0, y = 0, z = 0, ow = 0, shadow = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; if (ow) outline(m, ow); return m; }
function textPlane(w, h, draw, pw = 512) { const c = document.createElement('canvas'); c.width = pw; c.height = Math.round(pw * h / w); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true })); m.userData.redraw = (...a) => { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); draw(g, c.width, c.height, ...a); t.needsUpdate = true; }; m.userData.redraw(); return m; }

// ---------------- sky / lights ----------------
const LOOK = {
  day: { top: '#3a94ee', bot: '#c9eeff', sun: '#fff6c8', hemi: '#e8f6ff', ground: '#6f8f4a', sunI: 2.3, fog: '#c9eeff' },
  gold: { top: '#e2705a', bot: '#ffd59a', sun: '#fff1b8', hemi: '#ffe2c0', ground: '#7a5a3a', sunI: 2.1, fog: '#ffd2a0' },
  dusk: { top: '#4a3c8a', bot: '#ff9a7a', sun: '#ffd0a0', hemi: '#c8b0e0', ground: '#4a3a50', sunI: 1.6, fog: '#e08a84' },
  night: { top: '#0e1340', bot: '#3c2f7c', sun: '#fff6d6', hemi: '#8890d0', ground: '#202040', sunI: 0.35, fog: '#2c2766' },
};
function skyDome() {
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: C('#3a94ee') }, bot: { value: C('#c4ecff') }, sunDir: { value: V(0.3, 0.5, -1).normalize() }, sunCol: { value: C('#fff6c8') }, night: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = (modelMatrix*vec4(position,1.)).xyz - cameraPosition; gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 top,bot,sunCol,sunDir; uniform float night; varying vec3 vP; float h(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453);}
      void main(){ vec3 d=normalize(vP); float y=clamp(d.y*1.5+0.12,0.,1.); vec3 c=mix(bot,top,pow(y,0.8)); float s=dot(d,normalize(sunDir));
      c+=sunCol*smoothstep(0.82,1.,s)*0.35; c=mix(c,sunCol,smoothstep(0.9965,0.997,s)); if(night>0.5){ vec3 q=floor(d*420.); if(h(q)>0.9985 && d.y>0.05) c+=vec3(1.,.97,.85)*0.9; } gl_FragColor=vec4(c,1.); }` });
  const s = new THREE.Mesh(new THREE.SphereGeometry(50000, 32, 16), m); s.frustumCulled = false; s.renderOrder = -10; return s;
}
function addLights(sc, o = {}) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x556644, 1.1); sc.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const s = o.shadow || 2600; Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 100, far: 20000 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 2;
  sc.add(sun, sun.target); sc.userData = { hemi, sun };
  if (o.sky !== false) { const sky = skyDome(); sc.add(sky); sc.userData.sky = sky; }
  sc.fog = new THREE.Fog(0xc9eeff, 4000, 40000);
}
function applyLook(sc, L, o = {}) {
  const { hemi, sun, sky } = sc.userData, sd = V(...(o.sunDir || [0.5, 0.6, 0.7])).normalize();
  if (sky) { const u = sky.material.uniforms; u.top.value.set(L.top); u.bot.value.set(L.bot); u.sunCol.value.set(L.sun); u.sunDir.value.copy(sd); u.night.value = L === LOOK.night ? 1 : 0; }
  const c = o.center || V(0, 0, 0); sun.position.copy(sd.clone().multiplyScalar(8000).add(c)); sun.target.position.copy(c); sun.color.set(mixHex(L.sun, '#ffffff', 0.4)); sun.intensity = o.sunI ?? L.sunI;
  hemi.color.set(L.hemi); hemi.groundColor.set(L.ground); hemi.intensity = o.hemiI ?? (L === LOOK.night ? 0.6 : 1.15);
  sc.fog.color.set(o.fogColor || L.fog); sc.fog.near = o.fogNear ?? 5000; sc.fog.far = o.fogFar ?? 45000;
  SPRITE_TINT = C(o.tint || (L === LOOK.night ? '#a8acdf' : L === LOOK.gold ? '#fff0dc' : '#ffffff'));
}
function cloud(scale) { const g = new THREE.Group(), m = toon('#ffffff'); [[-1.2, 0, 0, 0.7], [-0.4, 0.4, 0.1, 0.9], [0.6, 0.2, -0.1, 0.8], [1.4, -0.1, 0, 0.6], [0, -0.2, 0.3, 0.9]].forEach(([x, y, z, r]) => { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 100, 2), m); s.position.set(x * 100, y * 100, z * 100); g.add(s); }); g.scale.setScalar(scale); return g; }

// ---------------- character billboards ----------------
const SPR = { pool: [], used: 0, tex: new Map(), frame: 0 }, BOX = { l: -240, r: 240, t: -540, b: 70 };
let SPRITE_TINT = C('#ffffff');
function texFor(params, res) {
  const key = res + '|' + JSON.stringify(params, (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v);
  let e = SPR.tex.get(key);
  if (!e) {
    const cw = Math.ceil((BOX.r - BOX.l) * res), ch = Math.ceil((BOX.b - BOX.t) * res);
    let old = null; for (const [k, v] of SPR.tex) if (v.frame < SPR.frame - 1 && v.cw === cw && v.ch === ch) { old = v; SPR.tex.delete(k); break; }
    e = old || { cv: Object.assign(document.createElement('canvas'), { width: cw, height: ch }), cw, ch };
    if (!e.tex) { e.tex = new THREE.CanvasTexture(e.cv); e.tex.colorSpace = THREE.SRGBColorSpace; e.tex.anisotropy = 4; }
    const g = e.cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cw, ch); g.setTransform(res, 0, 0, res, -BOX.l * res, -BOX.t * res);
    guy(g, { ...params, x: 0, y: 0, s: 1, rot: 0 }); e.tex.needsUpdate = true; SPR.tex.set(key, e);
  }
  e.frame = SPR.frame; return e.tex;
}
function spriteMesh() {
  if (SPR.used < SPR.pool.length) return SPR.pool[SPR.used++];
  const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.45, side: THREE.DoubleSide }));
  m.castShadow = true; m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: 0.45 });
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: BLOB, transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2;
  m.userData.sh = sh; SPR.pool.push(m); SPR.used++; return m;
}
function person(sc, p, x, y, z, s, o = {}) {
  const res = o.res || clamp(s * 1.0, 0.3, 2.6), tex = texFor(p, res), m = spriteMesh();
  m.material.map = tex; m.material.color.copy(o.tint || SPRITE_TINT); m.material.needsUpdate = true; m.customDepthMaterial.map = tex;
  m.scale.set((BOX.r - BOX.l) * s, (BOX.b - BOX.t) * s, 1); m.position.set(x, y - BOX.b * s, z);
  m.rotation.set(0, Math.atan2(camera.position.x - x, camera.position.z - z), 0); m.rotateZ(-(p.rot || 0));
  sc.add(m); const sh = m.userData.sh; sh.position.set(x, (o.ground ?? y) + 1.5, z); sh.scale.set(150 * s, 70 * s, 1); sh.material.opacity = o.noShadow ? 0 : 1; sc.add(sh);
  return m;
}
function resetSprites() { for (const m of SPR.pool) { m.parent && m.parent.remove(m); m.userData.sh.parent && m.userData.sh.parent.remove(m.userData.sh); } SPR.used = 0; SPR.frame++; }
// where a whole character's hands are (for 3D props held in the 'hold'/'pull' poses)
function handsAt(x, y, z, s, pull = 0) { const toCam = V(camera.position.x - x, 0, camera.position.z - z).normalize(), right = V(toCam.z, 0, -toCam.x); return { c: V(x, y + 154 * s, z).add(toCam.clone().multiplyScalar(30 * s)).add(V(toCam.z, 0, -toCam.x).multiplyScalar(70 * s)), right, toCam, span: (110 + pull * 92) * s }; }

// ---------------- jets ----------------
const R = 120, FL = 1500;
function makeJet(kind) {
  const g = new THREE.Group(), body = toon(kind === 'round' ? '#f4f4f0' : '#f6f1ea', METALTEX, [6, 1]), stripe = toon(kind === 'round' ? '#3f72dc' : '#d8423d');
  const parts = { all: g, kind };
  const fus = new THREE.Group(); g.add(fus); parts.fus = fus;
  const mkBody = (x0, x1) => { const m = mesh(new THREE.CylinderGeometry(R, R, x1 - x0, 32, 1, true), body, (x0 + x1) / 2, 0, 0, 5); m.rotation.z = Math.PI / 2; return m; };
  if (kind === 'square') { parts.front = new THREE.Group(); parts.rear = new THREE.Group(); fus.add(parts.front, parts.rear); parts.front.add(mkBody(-FL / 2, 30)); parts.rear.add(mkBody(30, FL / 2)); }
  else { parts.front = new THREE.Group(); parts.rear = parts.front; fus.add(parts.front); parts.front.add(mkBody(-FL / 2, FL / 2)); }
  const nose = mesh(new THREE.SphereGeometry(R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), body, -FL / 2, 0, 0, 5); nose.rotation.z = Math.PI / 2; nose.scale.set(1, 1.9, 1); parts.front.add(nose);
  const cock = mesh(new THREE.BoxGeometry(70, 26, 150), toon('#20324f'), -FL / 2 - 120, 52, 0, 2); cock.rotation.z = -0.35; parts.front.add(cock);
  const tail = mesh(new THREE.ConeGeometry(R, 520, 32, 1, true), body, FL / 2 + 260, 20, 0, 5); tail.rotation.z = -Math.PI / 2; tail.scale.set(1, 1, 1); parts.rear.add(tail);
  const finS = new THREE.Shape(); finS.moveTo(0, 0); finS.lineTo(330, 0); finS.lineTo(420, 380); finS.lineTo(300, 380); finS.lineTo(0, 0);
  const fin = mesh(new THREE.ExtrudeGeometry(finS, { depth: 16, bevelEnabled: false }), body, FL / 2 + 80, 90, -8, 4); parts.rear.add(fin);
  for (const sd of [-1, 1]) { const st = new THREE.Shape(); st.moveTo(0, 0); st.lineTo(220, 0); st.lineTo(300, 300); st.lineTo(200, 300); st.lineTo(0, 0); const m = mesh(new THREE.ExtrudeGeometry(st, { depth: 12, bevelEnabled: false }), body, FL / 2 + 100, 40, 0, 3); m.rotation.x = sd * Math.PI / 2; parts.rear.add(m); }
  // swept wings with buried engines
  parts.wings = new THREE.Group(); g.add(parts.wings);
  for (const sd of [-1, 1]) { const w = new THREE.Shape(); w.moveTo(0, 0); w.lineTo(420, 0); w.lineTo(560, 820); w.lineTo(430, 820); w.lineTo(0, 0); const m = mesh(new THREE.ExtrudeGeometry(w, { depth: 22, bevelEnabled: false }), body, -180, -60, 0, 4); m.rotation.x = sd * Math.PI / 2; parts.wings.add(m);
    for (const k of [0, 1]) { const e = mesh(new THREE.CylinderGeometry(34, 38, 300, 16), toon('#cfcfd4', METALTEX), 40, -60, sd * (150 + k * 80), 3); e.rotation.z = Math.PI / 2; parts.wings.add(e); const ei = mesh(new THREE.CircleGeometry(28, 16), new THREE.MeshBasicMaterial({ color: '#202028' }), -111, -60, sd * (150 + k * 80), 0); ei.rotation.y = -Math.PI / 2; parts.wings.add(ei); } }
  // cheatline + windows on both sides
  parts.windows = [];
  for (const sd of [-1, 1]) {
    for (const [x0, x1, grp] of kind === 'square' ? [[-FL / 2 + 80, 30, parts.front], [30, FL / 2, parts.rear]] : [[-FL / 2 + 80, FL / 2, parts.front]]) { const st = mesh(new THREE.BoxGeometry(x1 - x0, 20, 4), stripe, (x0 + x1) / 2, -14, sd * (R - 0.5), 0, false); grp.add(st); }
    for (let i = 0; i < 14; i++) {
      const x = -560 + i * 86, grp = kind === 'square' && x > 30 ? parts.rear : parts.front, y = 34, zz = sd * Math.sqrt(R * R - y * y);
      const frame = kind === 'square' ? new THREE.PlaneGeometry(64, 64) : new THREE.CircleGeometry(25, 24);
      const glass = kind === 'square' ? new THREE.PlaneGeometry(52, 52) : new THREE.CircleGeometry(19, 24);
      const fm = mesh(frame, new THREE.MeshBasicMaterial({ color: '#14110f' }), x, y, zz + sd * 1.2, 0, false), gm = mesh(glass, new THREE.MeshBasicMaterial({ color: '#7fc4ff' }), x, y, zz + sd * 2, 0, false);
      for (const m of [fm, gm]) { m.rotation.y = sd > 0 ? 0 : Math.PI; m.rotation.x = -Math.asin(y / R) * sd * 0; grp.add(m); }
      const hl = mesh(kind === 'square' ? new THREE.PlaneGeometry(10, 40) : new THREE.CircleGeometry(5, 10), new THREE.MeshBasicMaterial({ color: '#e8f6ff' }), x - 10, y + 6, zz + sd * 2.6, 0, false); hl.rotation.y = sd > 0 ? 0 : Math.PI; hl.rotation.z = 0.5; grp.add(hl);
      parts.windows.push(gm);
    }
  }
  // the crack (square jet only): tube along the cabin from a window corner
  if (kind === 'square') { parts.crack = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#14110f' })); fus.add(parts.crack); }
  return parts;
}
// gear (simple) so jets sit on the ground
function addGear(j) { const gm = toon('#2a2a33'); for (const [x, z] of [[-560, 0], [-120, -170], [-120, 170]]) { j.all.add(mesh(new THREE.CylinderGeometry(6, 6, 90, 6), gm, x, -150, z, 1.5)); const w = mesh(new THREE.CylinderGeometry(30, 30, 22, 16), toon('#1b1a20'), x, -195, z, 2); w.rotation.x = Math.PI / 2; j.all.add(w); } }
const JET_Y = 225; // fuselage centre height when on wheels
function crackGeo(j, len, wob = 1) {
  const pts = [], x0 = -35 + 26, y0 = 34 - 26; // lower-right corner of window #6 (front side)
  const n = 40; for (let i = 0; i <= n; i++) { const u = i / n * len; const x = x0 + u * 620, y = y0 - 6 * u + Math.sin(i * 2.7) * 7 * wob + Math.sin(i * 1.3) * 5; const z = Math.sqrt(Math.max(R * R - y * y, 0)) + 3; pts.push(V(x, y, z)); }
  if (pts.length < 2 || len <= 0.001) { j.crack.visible = false; return; }
  j.crack.visible = true; j.crack.geometry.dispose(); j.crack.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 2.6 + len * 1.5, 5);
}

// ---------------- AIRFIELD set ----------------
const AF = {};
function buildAirfield() {
  const sc = new THREE.Scene(); addLights(sc, { shadow: 3200 }); SC.air = sc;
  sc.add(mesh(new THREE.PlaneGeometry(90000, 90000).rotateX(-Math.PI / 2), toon('#86c95e', BRUSHTEX, [120, 120]), 0, 0, 0, 0, false));
  AF.ground = sc.children[sc.children.length - 1];
  sc.add(mesh(new THREE.BoxGeometry(30000, 4, 700), toon('#5b5f66', CONCRETE, [40, 1]), 0, 1, -2600, 0, false));
  for (let i = 0; i < 60; i++) sc.add(mesh(new THREE.BoxGeometry(260, 6, 30), new THREE.MeshBasicMaterial({ color: '#f4f4f0' }), -15000 + i * 500, 3, -2600, 0, false));
  sc.add(mesh(new THREE.BoxGeometry(9000, 4, 3600), toon('#c9c6bc', CONCRETE, [12, 5]), 0, 2, 0, 0, false));
  // hangar: arched shell open towards +z
  const hg = new THREE.Group(); hg.position.set(-2600, 0, -900); sc.add(hg); AF.hangar = hg;
  const shell = mesh(new THREE.CylinderGeometry(1400, 1400, 2600, 40, 1, true, -Math.PI / 2, Math.PI), toon('#b8c0c8', METALTEX, [8, 4]), 0, 0, 0, 0); shell.rotation.x = Math.PI / 2; shell.material.side = THREE.DoubleSide; hg.add(shell);
  const back = mesh(new THREE.CircleGeometry(1400, 40, 0, Math.PI), toon('#9aa4ae', METALTEX, [4, 2]), 0, 0, -1300, 0); hg.add(back);
  const sign = textPlane(900, 220, (g, w, h) => { g.fillStyle = '#20324f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffd34d'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16); g.font = `900 ${h * 0.6}px Baloo2`; g.textAlign = 'center'; g.fillStyle = '#ffd34d'; g.fillText('HANGAR 1952', w / 2, h * 0.72); }, 900);
  sign.position.set(0, 1180, 1310); hg.add(sign);
  hg.add(mesh(new THREE.BoxGeometry(2900, 30, 60), toon('#3a3a44'), 0, 1250, 1300, 2));
  // ladder inside hangar
  AF.ladder = new THREE.Group(); const lm = toon('#d8a03a'); for (const x of [-40, 40]) AF.ladder.add(mesh(new THREE.BoxGeometry(10, 340, 10), lm, x, 170, 0, 2)); for (let i = 0; i < 6; i++) AF.ladder.add(mesh(new THREE.BoxGeometry(90, 8, 14), lm, 0, 40 + i * 55, 0, 1.5)); sc.add(AF.ladder);
  // control tower
  const tw = new THREE.Group(); tw.position.set(2600, 0, -1800); sc.add(tw);
  tw.add(mesh(new THREE.BoxGeometry(320, 1100, 320), toon('#efe6d2', BRUSHTEX), 0, 550, 0, 5));
  tw.add(mesh(new THREE.BoxGeometry(460, 160, 460), toon('#7fc4ff'), 0, 1180, 0, 5), mesh(new THREE.BoxGeometry(500, 40, 500), toon('#d8423d'), 0, 1280, 0, 4));
  // hills, trees, clouds
  const hill = toon('#6fae58', BRUSHTEX, [6, 3]);
  for (let i = 0; i < 16; i++) { const h = mesh(new THREE.SphereGeometry(1, 24, 12), hill, -24000 + i * 3200 + rnd(i) * 900, -200, -14000 - rnd(i + 3) * 6000, 0, false); h.scale.set(3000 + rnd(i) * 2000, 1400 + rnd(i + 2) * 1300, 2400); sc.add(h); }
  const NT = 160, d = new THREE.Object3D(), trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(14, 18, 120, 6), toon('#6b4426'), NT), crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), toon('#4f9a46', BRUSHTEX), NT);
  for (let i = 0; i < NT; i++) { const x = (rnd(i * 3) - 0.5) * 30000, z = -5000 - rnd(i * 3 + 1) * 8000, s = 1 + rnd(i + 5); d.position.set(x, 60 * s, z); d.scale.set(s, s, s); d.updateMatrix(); trunk.setMatrixAt(i, d.matrix); d.position.set(x, 200 * s, z); d.scale.set(100 * s, 130 * s, 100 * s); d.updateMatrix(); crown.setMatrixAt(i, d.matrix); }
  for (const m of [trunk, crown]) { m.castShadow = true; sc.add(m); }
  AF.clouds = []; for (let i = 0; i < 16; i++) { const c = cloud(3 + rnd(i) * 3); c.position.set((rnd(i + 3) - 0.5) * 30000, 3500 + rnd(i + 6) * 3000, -9000 - rnd(i + 9) * 16000); sc.add(c); AF.clouds.push(c); }
  // jets
  AF.H = makeJet('round'); addGear(AF.H); sc.add(AF.H.all);
  AF.R = makeJet('square'); addGear(AF.R); sc.add(AF.R.all);
  AF.F = makeJet('round'); sc.add(AF.F.all); // flyby jet
  // crowd ropes + confetti + flashes
  AF.confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(14, 22), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: false }), 260); AF.confetti.count = 0; sc.add(AF.confetti);
  const cc = [C('#e8473d'), C('#ffd34d'), C('#3f72dc'), C('#2fae6a'), C('#ffffff')]; for (let i = 0; i < 260; i++) AF.confetti.setColorAt(i, cc[i % 5]);
  AF.tea = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), toon('#b8743a'), 60); AF.tea.count = 0; sc.add(AF.tea);
  AF.hotel = textPlane(520, 150, (g, w, h, a = 1) => { g.globalAlpha = a; g.shadowColor = '#ff4fa0'; g.shadowBlur = 30; g.font = `900 ${h * 0.75}px Baloo2`; g.textAlign = 'center'; g.fillStyle = '#ffd1ea'; g.fillText('HOTEL', w / 2, h * 0.78); }, 520); sc.add(AF.hotel);
}
// ---------------- TANK set ----------------
const TK = {};
const TW = 3400, TD = 2400, THH = 760, WATER = 560;
function buildTank() {
  const sc = new THREE.Scene(); addLights(sc, { shadow: 3200 }); SC.tank = sc;
  sc.add(mesh(new THREE.PlaneGeometry(60000, 60000).rotateX(-Math.PI / 2), toon('#c9c6bc', CONCRETE, [80, 80]), 0, 0, 0, 0, false));
  const steel = toon('#7f8a96', METALTEX, [6, 2]);
  sc.add(mesh(new THREE.BoxGeometry(TW, THH, 50), steel, 0, THH / 2, -TD / 2, 5), mesh(new THREE.BoxGeometry(TW, THH, 50), steel, 0, THH / 2, TD / 2, 5));
  sc.add(mesh(new THREE.BoxGeometry(50, THH, TD), steel, -TW / 2, THH / 2, 0, 5), mesh(new THREE.BoxGeometry(50, THH, TD), steel, TW / 2, THH / 2, 0, 5));
  // walkway on the near wall with railing
  sc.add(mesh(new THREE.BoxGeometry(TW + 200, 20, 200), toon('#5a6470', METALTEX), 0, THH + 10, TD / 2 + 60, 3));
  for (let i = 0; i < 18; i++) sc.add(mesh(new THREE.BoxGeometry(8, 90, 8), toon('#d8a03a'), -TW / 2 + i * 200, THH + 65, TD / 2 + 150, 1.5));
  sc.add(mesh(new THREE.BoxGeometry(TW, 10, 10), toon('#d8a03a'), 0, THH + 110, TD / 2 + 150, 1.5));
  TK.waterMat = new THREE.MeshPhongMaterial({ color: '#3ea2d6', shininess: 90, specular: 0x88aacc, map: WAVETEX.clone(), transparent: true, opacity: 0.88 }); TK.waterMat.map.repeat.set(4, 3); TK.waterMat.map.needsUpdate = true;
  const w = new THREE.Mesh(new THREE.PlaneGeometry(TW - 50, TD - 50), TK.waterMat); w.rotation.x = -Math.PI / 2; w.position.y = WATER; w.receiveShadow = true; w.renderOrder = 2; sc.add(w); TK.water = w;
  // gantry crane
  const gm = toon('#e8b23a', BRUSHTEX);
  for (const x of [-TW / 2 - 200, TW / 2 + 200]) for (const z of [-TD / 2 - 100, TD / 2 + 100]) sc.add(mesh(new THREE.BoxGeometry(60, 1900, 60), gm, x, 950, z, 3));
  for (const z of [-450, 450]) sc.add(mesh(new THREE.BoxGeometry(TW + 500, 70, 70), gm, 0, 1900, z, 3));
  TK.cables = []; for (let i = 0; i < 4; i++) { const c = mesh(new THREE.CylinderGeometry(4, 4, 1, 6), toon('#2a2a33'), 0, 0, 0, 0); sc.add(c); TK.cables.push(c); }
  // jets (fuselages only) inside the tank
  TK.R = makeJet('square'); TK.R.wings.visible = false; sc.add(TK.R.all);
  TK.H = makeJet('round'); TK.H.wings.visible = false; sc.add(TK.H.all);
  // cycle counter board
  TK.board = textPlane(700, 260, (g, w, h, n = 0) => { g.fillStyle = '#1b1f2e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffd34d'; g.lineWidth = 10; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#ffd34d'; g.font = `800 ${h * 0.22}px Baloo2`; g.textAlign = 'center'; g.fillText('PRESSURE CYCLES', w / 2, h * 0.3); g.font = `900 ${h * 0.5}px Montserrat`; g.fillStyle = '#ffffff'; g.fillText(String(n).padStart(4, '0'), w / 2, h * 0.82); }, 700);
  TK.board.position.set(-TW / 2 - 300, 1250, TD / 2 + 100); TK.board.rotation.y = 0.5; sc.add(TK.board);
  sc.add(mesh(new THREE.BoxGeometry(30, 1100, 30), toon('#3a3a44'), -TW / 2 - 300, 550, TD / 2 + 90, 2));
  TK.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshPhongMaterial({ color: '#d8f2ff', shininess: 80 }), 700); TK.drops.count = 0; sc.add(TK.drops);
  TK.ripples = [0, 1, 2, 3, 4, 5].map(() => { const r = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; sc.add(r); return r; });
  TK.wall = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshPhongMaterial({ color: '#cfefff', transparent: true, opacity: 0.75, shininess: 100 })); sc.add(TK.wall);
  TK.clouds = []; for (let i = 0; i < 10; i++) { const c = cloud(3 + rnd(i) * 2); c.position.set((rnd(i + 3) - 0.5) * 30000, 4000 + rnd(i + 6) * 2500, -12000 - rnd(i + 9) * 12000); sc.add(c); }
  const hall = toon('#d9cbb0', BRUSHTEX, [6, 2]); sc.add(mesh(new THREE.BoxGeometry(14000, 2600, 300), hall, 0, 1300, -5200, 0));
}
// ---------------- WORKSHOP set (night) ----------------
const WS = {};
function buildWorkshop() {
  const sc = new THREE.Scene(); addLights(sc, { sky: false, shadow: 1500 }); SC.shop = sc; sc.background = C('#1a1838');
  const wood = toon('#8a5a32', BRUSHTEX, [3, 3]);
  sc.add(mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), toon('#5a4a6a', BRUSHTEX, [10, 10]), 0, 0, 0, 0, false));
  const wall = toon('#3b3f6e', BRUSHTEX, [6, 3]); sc.add(mesh(new THREE.BoxGeometry(4000, 2400, 40), wall, 0, 1200, -900, 0), mesh(new THREE.BoxGeometry(40, 2400, 4000), wall, -1500, 1200, 0, 0));
  // window with moon
  const win = textPlane(600, 700, (g, w, h) => { g.fillStyle = '#20286a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.fillStyle = '#fffbe0'; g.fillRect(rnd(i) * w, rnd(i + 4) * h, 3, 3); } g.fillStyle = '#fff6d6'; g.beginPath(); g.arc(w * 0.68, h * 0.3, 70, 0, 7); g.fill(); g.strokeStyle = '#6b4426'; g.lineWidth = 24; g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke(); }, 600);
  win.position.set(500, 1250, -875); sc.add(win);
  // blueprints with windows sketched
  for (let i = 0; i < 3; i++) { const bp = textPlane(420, 300, (g, w, h) => { g.fillStyle = '#1f5fa8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e9f4ff'; g.lineWidth = 4; g.strokeRect(10, 10, w - 20, h - 20); g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.38, h * 0.18, 0, 0, 7); g.stroke(); for (let k = 0; k < 5; k++) { if (i % 2) { g.beginPath(); g.arc(w * 0.25 + k * w * 0.12, h / 2, 12, 0, 7); g.stroke(); } else g.strokeRect(w * 0.25 + k * w * 0.12 - 12, h / 2 - 12, 24, 24); } }, 420); bp.position.set(-700 + i * 470, 1500 - (i % 2) * 120, -878); bp.rotation.z = (rnd(i) - 0.5) * 0.08; sc.add(bp); }
  // desk + lamp
  const desk = new THREE.Group(); desk.position.set(0, 0, 0); desk.scale.setScalar(0.55); sc.add(desk); WS.desk = desk;
  desk.add(mesh(new THREE.BoxGeometry(900, 40, 460), wood, 0, 420, 0, 4)); for (const x of [-410, 410]) for (const z of [-190, 190]) desk.add(mesh(new THREE.BoxGeometry(30, 400, 30), wood, x, 200, z, 2));
  desk.add(mesh(new THREE.CylinderGeometry(50, 60, 20, 16), toon('#2a2a33'), -320, 450, -120, 2));
  const arm = mesh(new THREE.CylinderGeometry(6, 6, 300, 8), toon('#2a2a33'), -300, 590, -100, 1.5); arm.rotation.z = -0.3; desk.add(arm);
  const shade = mesh(new THREE.ConeGeometry(80, 110, 20, 1, true), toon('#2f8f5a'), -230, 740, -80, 3); shade.rotation.z = 0.6; shade.material.side = THREE.DoubleSide; desk.add(shade);
  WS.lamp = new THREE.SpotLight('#ffcf8a', 30, 2600, 0.9, 0.5, 1); WS.lamp.position.set(-220, 720, -70); WS.lamp.target.position.set(60, 440, 40); WS.lamp.castShadow = true; WS.lamp.shadow.mapSize.set(1024, 1024); desk.add(WS.lamp, WS.lamp.target);
  WS.bulb = mesh(new THREE.SphereGeometry(22, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff2c0' }), -215, 705, -75, 0, false); desk.add(WS.bulb);
  // paper stack + scissors
  for (let i = 0; i < 8; i++) desk.add(mesh(new THREE.BoxGeometry(170, 3, 230), toon('#f6ecd2'), 230 + rnd(i) * 10, 443 + i * 3, -60 + rnd(i + 2) * 10, 0));
  // scraps on floor (instanced)
  WS.scraps = new THREE.InstancedMesh(new THREE.PlaneGeometry(40, 30), toon('#f6ecd2'), 160); WS.scraps.material.side = THREE.DoubleSide; sc.add(WS.scraps);
  const d = new THREE.Object3D(); for (let i = 0; i < 160; i++) { d.position.set((rnd(i) - 0.5) * 1600, 1 + rnd(i + 2) * 2, (rnd(i + 4) - 0.3) * 1200); d.rotation.set(-Math.PI / 2, 0, rnd(i + 8) * 6); d.scale.setScalar(0.6 + rnd(i + 9)); d.updateMatrix(); WS.scraps.setMatrixAt(i, d.matrix); }
  WS.flying = new THREE.InstancedMesh(new THREE.PlaneGeometry(36, 26), toon('#f6ecd2'), 80); WS.flying.material.side = THREE.DoubleSide; WS.flying.count = 0; sc.add(WS.flying);
  WS.paper = makePaperPair(sc);
}
// paper sheet with a hole that tears from the hole's corner (square) or holds (round)
function holeSheet(kind, half) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 320; const g = c.getContext('2d'), w = 256, h = 320;
  g.fillStyle = '#f6ecd2'; g.beginPath();
  // jagged tear line from the hole's lower corner downwards (square) or a straight cut line used only when torn
  const tear = []; for (let i = 0; i <= 10; i++) tear.push([w / 2 + 20 + Math.sin(i * 2.3) * 8 + (i % 2 ? 6 : -6), h / 2 + 32 + i * ((h / 2 - 32) / 10)]);
  if (half === 'whole') g.rect(0, 0, w, h);
  else if (half === 'L') { g.moveTo(0, 0); g.lineTo(w / 2 + 32, 0); g.lineTo(w / 2 + 32, h / 2 + 32); tear.forEach(p => g.lineTo(p[0], p[1])); g.lineTo(0, h); }
  else { g.moveTo(w, 0); g.lineTo(w / 2 + 32, 0); g.lineTo(w / 2 + 32, h / 2 + 32); tear.forEach(p => g.lineTo(p[0], p[1])); g.lineTo(w, h); }
  g.closePath(); g.fill(); g.lineWidth = 6; g.strokeStyle = '#14110f'; g.stroke();
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); if (kind === 'square') g.rect(w / 2 - 32, h / 2 - 32, 64, 64); else g.arc(w / 2, h / 2, 34, 0, 7); g.fill();
  g.globalCompositeOperation = 'source-over'; g.beginPath(); if (kind === 'square') g.rect(w / 2 - 32, h / 2 - 32, 64, 64); else g.arc(w / 2, h / 2, 34, 0, 7); g.lineWidth = 5; g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makePaperPair(sc) {
  const mk = tex => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.25), new THREE.MeshToonMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, gradientMap: GRAD, emissive: '#8a7f68', emissiveMap: tex })); m.castShadow = true; sc.add(m); return m; };
  const P = { whole: { square: mk(holeSheet('square', 'whole')), round: mk(holeSheet('round', 'whole')) }, L: mk(holeSheet('square', 'L')), R: mk(holeSheet('square', 'R')) };
  P.hide = () => { P.whole.square.visible = P.whole.round.visible = P.L.visible = P.R.visible = false; };
  return P;
}
// pose a held sheet between the hands; kind square/round; tear 0..1
function heldPaper(P, hands, kind, tear, size) {
  P.hide();
  const place = (m, off, rot) => { m.visible = true; m.scale.set(size, size, 1); m.position.copy(hands.c).add(hands.right.clone().multiplyScalar(off)).add(V(0, -size * 0.5, 0)); m.lookAt(m.position.clone().add(hands.toCam)); m.rotateZ(rot); };
  if (kind === 'round' || tear <= 0) { const m = P.whole[kind]; place(m, 0, 0); m.scale.x = size * (1 + 0.05 * (kind === 'round' ? 1 : 0) * clamp(-tear)); return; }
  const k = easeOut(tear); place(P.L, -k * size * 0.35, k * 0.35); place(P.R, k * size * 0.35, -k * 0.35);
}
// ---------------- LAB set (x-ray of the fuselage skin) ----------------
const LB = {};
function buildLab() {
  const sc = new THREE.Scene(); SC.lab = sc; sc.background = C('#0f2f66');
  sc.add(new THREE.HemisphereLight(0xdfefff, 0x203060, 1.4)); const k = new THREE.DirectionalLight(0xffffff, 1.6); k.position.set(600, 900, 1400); sc.add(k);
  const grid = new THREE.GridHelper(8000, 80, 0x5f8fd0, 0x2f5fa0); grid.rotation.x = Math.PI / 2; grid.position.z = -800; sc.add(grid);
  // curved skin panel with a square and a round window
  const skin = new THREE.Shape(); skin.moveTo(-900, -420); skin.lineTo(900, -420); skin.lineTo(900, 420); skin.lineTo(-900, 420); skin.lineTo(-900, -420);
  const sq = new THREE.Path(); sq.moveTo(-560, -110); sq.lineTo(-340, -110); sq.lineTo(-340, 110); sq.lineTo(-560, 110); sq.lineTo(-560, -110); skin.holes.push(sq);
  const ci = new THREE.Path(); ci.absarc(450, 0, 115, 0, Math.PI * 2, true); skin.holes.push(ci);
  const pm = new THREE.MeshToonMaterial({ color: '#cfd8e4', gradientMap: GRAD, map: METALTEX.clone(), transparent: true, opacity: 0.92, side: THREE.DoubleSide }); pm.map.repeat.set(0.002, 0.002); pm.map.needsUpdate = true;
  LB.panel = mesh(new THREE.ExtrudeGeometry(skin, { depth: 26, bevelEnabled: false }), pm, 0, 0, -13, 4); sc.add(LB.panel);
  // stream lines (tubes) around the two holes
  LB.lines = []; const lm = (c) => new THREE.MeshBasicMaterial({ color: c });
  for (let i = 0; i < 15; i++) { const y0 = -390 + i * 55.7; const m = new THREE.Mesh(new THREE.BufferGeometry(), lm('#7fd0ff')); m.position.z = 30; sc.add(m); LB.lines.push({ m, y0 }); }
  LB.hot = [[-560, -110], [-340, -110], [-340, 110], [-560, 110]].map(([x, y]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(30, 16, 12), new THREE.MeshBasicMaterial({ color: '#ff3b2f', transparent: true })); s.position.set(x, y, 30); sc.add(s); return s; });
  LB.arrows = []; for (let i = 0; i < 12; i++) { const a = new THREE.ArrowHelper(V(0, 0, 1), V(-800 + (i % 6) * 320, -250 + Math.floor(i / 6) * 500, -400), 300, 0xffd34d, 90, 60); sc.add(a); LB.arrows.push(a); }
}
function streamline(y0, cx, cy, rad, sq) { // potential flow around a cylinder, squashed for the square hole
  const pts = [];
  for (let x = -900; x <= 900; x += 15) {
    let y = y0; const dx = x - cx;
    // solve psi = y' (1 - R^2/r^2) = y0' for y' (few Newton steps)
    let yp = y0 - cy; const target = y0 - cy;
    for (let k = 0; k < 8; k++) { const r2 = dx * dx + yp * yp + 1e-3; const f = yp * (1 - rad * rad / r2) - target; const df = (1 - rad * rad / r2) + yp * (2 * rad * rad * yp / (r2 * r2)); yp -= f / (Math.abs(df) < 1e-3 ? 1e-3 : df); }
    if (Math.abs(target) < rad * 1.02 && Math.abs(dx) < rad) yp = Math.sign(target || 1) * Math.max(Math.abs(yp), rad * (sq ? 1.0 : 1.02));
    y = cy + yp; pts.push(V(x, y, 0));
  }
  return pts;
}

// ---------------- CABIN set ----------------
const CB = {};
function buildCabin() {
  const sc = new THREE.Scene(); SC.cabin = sc; sc.background = C('#2a2238');
  sc.add(new THREE.HemisphereLight(0xfff2dc, 0x403040, 1.3)); const key = new THREE.PointLight('#fff2dc', 6, 4000, 1); key.position.set(0, 300, 0); sc.add(key); CB.key = key;
  const shell = mesh(new THREE.CylinderGeometry(330, 330, 4200, 32, 1, true), toon('#efe7da', BRUSHTEX, [6, 2]), 0, 150, 0, 0, false); shell.rotation.x = Math.PI / 2; shell.material.side = THREE.BackSide; sc.add(shell);
  sc.add(mesh(new THREE.BoxGeometry(560, 10, 4200), toon('#3f4a7a', BRUSHTEX, [2, 10]), 0, -100, 0, 0, false));
  sc.add(mesh(new THREE.BoxGeometry(110, 12, 4200), toon('#b8423d'), 0, -94, 0, 0, false));
  // round windows with daylight + seats
  CB.seats = [];
  for (let r = 0; r < 14; r++) { const z = 1700 - r * 260;
    for (const sd of [-1, 1]) { const ang = sd * 1.15, x = Math.sin(ang) * 326, y = 150 - Math.cos(ang) * 326 * 0 + 60;
      const w = mesh(new THREE.CircleGeometry(30, 24), new THREE.MeshBasicMaterial({ color: '#bfe6ff' }), sd * 312, 170, z - 40, 0, false); w.rotation.y = -sd * Math.PI / 2; sc.add(w);
      const f = mesh(new THREE.RingGeometry(30, 40, 24), new THREE.MeshBasicMaterial({ color: '#c9bfae' }), sd * 311, 170, z - 40, 0, false); f.rotation.y = -sd * Math.PI / 2; sc.add(f);
      for (const k of [0, 1]) { const sx = sd * (110 + k * 105); const seat = new THREE.Group(); seat.position.set(sx, -95, z); seat.add(mesh(new THREE.BoxGeometry(95, 60, 90), toon('#3f72dc', BRUSHTEX), 0, 60, 0, 3), mesh(new THREE.BoxGeometry(95, 170, 24), toon('#3f72dc', BRUSHTEX), 0, 150, 48, 3), mesh(new THREE.BoxGeometry(80, 30, 26), toon('#f4f1ea'), 0, 245, 48, 2)); sc.add(seat); CB.seats.push({ seat, sd, k, z }); } }
    for (const sd of [-1, 1]) sc.add(mesh(new THREE.BoxGeometry(220, 90, 240), toon('#e6ddcc'), sd * 210, 390, z, 3)); }
}

// ---------------- init / render ----------------
export function setup() {
  GL = document.createElement('canvas'); GL.width = W; GL.height = H;
  renderer = new THREE.WebGLRenderer({ canvas: GL, antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  makeTex(); buildAirfield(); buildTank(); buildWorkshop(); buildLab(); buildCabin();
  composer = new EffectComposer(renderer); composer.setPixelRatio(1); composer.setSize(W, H);
  renderPass = new RenderPass(SC.air, camera); composer.addPass(renderPass);
  bokeh = new BokehPass(SC.air, camera, { focus: 1500, aperture: 0, maxblur: 0.008 }); composer.addPass(bokeh); composer.addPass(new OutputPass());
  window.renderAt = renderAt;
}
function render3d(t) {
  resetSprites();
  const [id, t0] = sceneAt(t), [, t1] = sceneT(id), lt = t - t0, u = clamp(lt / (t1 - t0));
  const sh = SHOTS[id](t, lt, u), sc = SC[sh.set || 'air'];
  camera.fov = sh.fov || 38; camera.position.copy(sh.pos); camera.up.set(0, 1, 0); camera.lookAt(sh.tgt); if (sh.roll) camera.rotateZ(sh.roll); camera.updateProjectionMatrix();
  if (sh.people) sh.people(sc);
  renderPass.scene = sc; bokeh.scene = sc;
  bokeh.uniforms.focus.value = sh.focus ? camera.position.distanceTo(sh.focus) : 1000; bokeh.uniforms.aperture.value = (sh.aperture ?? 0) * 1e-5; bokeh.uniforms.maxblur.value = sh.maxblur ?? 0.009; bokeh.enabled = (sh.aperture ?? 0) > 0;
  composer.render(); return sh;
}
function project(p) { const v = p.clone().project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H, v.z]; }
// sub-frame motion blur windows for the fastest camera moves
function blurN(t) { const w = [[EV.chokes + 0.25, EV.chokes + 0.6, 5], [EV.quote - 0.02, EV.quote + 0.25, 4], [EV.jet - 0.2, EV.jet + 0.5, 4], [EV.races, EV.races + 0.4, 4], [EV.bursts - 0.05, EV.bursts + 0.4, 5], [EV.blasts - 0.05, EV.blasts + 0.5, 5], [EV.round2, EV.round2 + 0.8, 4], [EV.what - 0.05, EV.what + 0.25, 4], [sceneT('weird')[0], sceneT('weird')[0] + 0.3, 4]]; for (const x of w) if (t >= x[0] && t <= x[1]) return x[2]; return 1; }
function renderAt(t) {
  const n = blurN(t), shutter = 1 / 60; let sh;
  for (let i = 0; i < n; i++) { const ts = n === 1 ? t : t + (i / (n - 1) - 0.5) * shutter, tt = sceneAt(ts)[0] === sceneAt(t)[0] ? ts : t; sh = render3d(tt); screen(CTX); CTX.globalAlpha = 1 / (i + 1); CTX.drawImage(GL, 0, 0); CTX.globalAlpha = 1; }
  extras(CTX, t, sh); post(CTX, t); overlays(CTX, t);
}
function extras(ctx, t, sh) {
  screen(ctx);
  if (sh.labels) for (const [p, s, size, a, rot] of sh.labels) { if (a <= 0) continue; const [x, y, z] = project(p); if (z > 1) continue; ctx.globalAlpha = clamp(a); txt(ctx, s, x, y, size, { font: 'Baloo2', rot: rot || 0, sc: 0.7 + 0.3 * clamp(a) }); ctx.globalAlpha = 1; }
  if (sh.flash) { ctx.fillStyle = `rgba(255,250,235,${sh.flash})`; ctx.fillRect(0, 0, W, H); }
}

// ---------------- camera helpers ----------------
const path = (pts, u) => new THREE.CatmullRomCurve3(pts.map(p => V(...p)), false, 'centripetal').getPoint(clamp(u));
const orbit = (c, r, a, h) => V(c[0] + Math.sin(a) * r, c[1] + h, c[2] + Math.cos(a) * r);
const hand = (t, k = 1) => V(noise(t * 0.9) * 6 * k, noise(t * 0.8 + 9) * 5 * k, 0); // gentle handheld drift
const HERO = { coat: '#3f72dc', hat: 'cap', face: '#f7f0e1' }, ENG = { coat: '#3f72dc', hat: 'cap' };
const RIV = { coat: '#d8423d', hat: 'bicorne', plume: '#d8423d', stache: 'handlebar', epaulettes: true };
const CROWD = ['#2f8f5a', '#e8a33a', '#8a5ad8', '#3fa0c8', '#d85a8a', '#6b8f3a'];
function placeJet(j, x, y, z, ry = 0, rz = 0) { j.all.position.set(x, y, z); j.all.rotation.set(0, ry, rz); }
function airLook(L, o) { applyLook(SC.air, L, o); AF.H.all.visible = AF.R.all.visible = true; AF.clouds.forEach((c, i) => c.position.x = (rnd(i + 3) - 0.5) * 30000 + (o?.t || 0) * (60 + i * 8)); AF.confetti.count = 0; AF.tea.count = 0; AF.hotel.visible = false; AF.F.all.visible = false; }
function inst(im, list) { const o = new THREE.Object3D(); let n = 0; for (const p of list) { o.position.copy(p.p); o.rotation.set(...(p.r || [0, 0, 0])); o.scale.setScalar(p.s || 1); o.updateMatrix(); im.setMatrixAt(n++, o.matrix); } im.count = n; im.instanceMatrix.needsUpdate = true; }
function pumpK(t) { const a = sceneT('pump')[0] + 0.3, b = EV.pssh[2] + 0.4; if (t < a || t > b + 0.3) return 0; if (t > EV.pssh[0] - 0.3) { let k = 0; for (const p of EV.pssh) k = Math.max(k, pulse(t, p, 0.04, 0.25)); return k; } return 0.5 + 0.5 * Math.sin((t - a) * Math.PI * 2 / 0.9 - Math.PI / 2); }
function tankJets(t, crack = 0, burst = 0) {
  const lowT = sstep(EV.lower - 0.2, EV.lower + 2.0, t), y = lerp(1500, WATER - 60, lowT), pk = pumpK(t);
  placeJet(TK.R, -150, y, -480, 0); placeJet(TK.H, 150, y, 520, 0);
  for (const j of [TK.R, TK.H]) j.fus.scale.set(1, 1 + 0.04 * pk, 1 + 0.04 * pk);
  // cables from gantry beams
  TK.cables.forEach((c, i) => { const j = i < 2 ? TK.R : TK.H, x = j.all.position.x + (i % 2 ? 450 : -450), z = j.all.position.z, a = V(x, 1890, (i < 2 ? -450 : 450)), b = V(x, j.all.position.y + R, z); const d = b.clone().sub(a); c.position.copy(a).add(b).multiplyScalar(0.5); c.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize()); c.scale.set(1, d.length(), 1); c.visible = burst < 0.2; });
  crackGeo(TK.R, crack);
  TK.R.front.position.set(-burst * 120, burst * 40, burst * 20); TK.R.rear.position.set(burst * 160, -burst * 30, -burst * 30); TK.R.front.rotation.z = burst * 0.08; TK.R.rear.rotation.z = -burst * 0.12;
  TK.water.position.y = WATER + Math.sin(t * 3) * 3; TK.waterMat.map.offset.set(t * 0.01, t * 0.006);
}
function tankLook(t, o = {}) { applyLook(SC.tank, o.L || LOOK.day, { sunDir: [0.6, 0.7, 0.9], ...o }); TK.drops.count = 0; TK.wall.visible = false; TK.ripples.forEach(r => r.visible = false); TK.board.userData.redraw(Math.round(3000 * sstep(sceneT('pump')[0] + 0.3, EV.pssh[2] + 0.2, t))); }
function shopLook(o = {}) { applyLook(SC.shop, LOOK.night, { sunDir: [0.3, 0.6, 0.8], sunI: 0.5, hemiI: 0.55, fogColor: '#1a1838', fogNear: 3000, fogFar: 12000, tint: '#ffe4c8', ...o }); WS.flying.count = 0; WS.paper.hide(); }

// ---------------- SHOTS ----------------
const SHOTS = {
  // 1. inside the hangar: hero on a ladder sanding a window corner; 120° orbit around him
  open(t, lt, u) {
    airLook(LOOK.day, { t, sunDir: [0.4, 0.7, 0.9] }); placeJet(AF.H, -2600, JET_Y, -900, 0); placeJet(AF.R, 900, JET_Y, 400, 0.3); AF.R.all.visible = true; crackGeo(AF.R, 0);
    const win = V(-2600 - 35, JET_Y + 34, -900 + R + 2); AF.ladder.position.set(win.x + 40, 0, win.z + 120); AF.ladder.visible = true;
    const a = lerp(-0.9, 0.55, easeIO(u)), pos = orbit([win.x, win.y, win.z], lerp(900, 640, easeIO(u)), a, lerp(120, 40, u)).add(hand(t));
    const sh = { pos, tgt: win.clone().add(V(40, 10, 60)), fov: 40, focus: win.clone().add(V(40, 0, 120)), aperture: 4 };
    // dust from the sanding block on every stroke
    let dust = []; for (const s of EV.sand) { const k = t - s; if (k < 0 || k > 0.7) continue; for (let i = 0; i < 10; i++) dust.push({ p: win.clone().add(V(10 + (rnd(i + s) - 0.5) * 80 * k * 3, -20 * k + rnd(i) * 20, 20 + rnd(i + 3) * 60 * k)), s: 5 + 10 * k }); }
    inst(AF.tea, dust);
    sh.people = sc => person(sc, { ...HERO, f: -1, mood: 'stern', arms: 'sand', sandT: t * 12.6, gait: 'stand' }, win.x + 40, 220, win.z + 140, 0.62, { res: 1.8, ground: 220 });
    return sh;
  },
  // 2. 1952: crane up from the hangar sign following a jet that roars overhead
  year(t, lt, u) {
    airLook(LOOK.day, { t }); placeJet(AF.H, -2600, JET_Y, -900, 0); AF.ladder.visible = false; placeJet(AF.R, 900, JET_Y, 400, 0.3);
    const jx = lerp(-9000, 9000, inv(EV.jet - 1.3, EV.jet + 1.6, t)); AF.F.all.visible = true; placeJet(AF.F, jx, 1700 + (jx + 9000) * 0.08, -600, Math.PI, 0.12); AF.F.all.rotation.set(0, Math.PI, -0.12);
    const k = easeIO(u);
    const pos = path([[-2400, 300, 1800], [-1800, 600, 2600], [-600, 900, 3200]], k).add(hand(t, 2));
    const tgt = path([[-2600, 1150, 400], [-2000, 1400, -400], [jx * 0.4, 1900, -600]], k);
    return { pos, tgt, fov: 42 };
  },
  // 3. dolly along the rival's square windows; neon HOTEL on "hotel"
  square(t, lt, u) {
    airLook(LOOK.day, { t, sunDir: [-0.5, 0.6, 0.8] }); placeJet(AF.R, 900, JET_Y, 400, 0); AF.ladder.visible = false; placeJet(AF.H, -2600, JET_Y, -900, 0); crackGeo(AF.R, 0);
    const k = easeIO(u), side = 400 + R;
    const pos = path([[900 - 900, JET_Y + 120, side + 420], [900 - 200, JET_Y + 40, side + 300], [900 + 500, JET_Y + 80, side + 380]], k).add(hand(t));
    const tgt = V(lerp(900 - 500, 900 + 300, k), JET_Y + 30, side);
    const ha = sstep(EV.hotel - 0.1, EV.hotel + 0.15, t); AF.hotel.visible = ha > 0; AF.hotel.userData.redraw(ha); AF.hotel.position.set(900 + 120, JET_Y + 250, side + 20);
    return { pos, tgt, fov: 38, roll: lerp(0.06, -0.04, k), focus: V(tgt.x, tgt.y, side), aperture: 2 };
  },
  // 4. hero's round-window jet rolls out of the hangar; whip to the rival spitting tea
  round(t, lt, u) {
    airLook(LOOK.day, { t, sunDir: [0.4, 0.7, 0.9] }); AF.ladder.visible = false; placeJet(AF.R, 900, JET_Y, 400, 0);
    const roll = easeIO(inv(0, 0.75, u)); placeJet(AF.H, lerp(-2600, -1500, roll), JET_Y, lerp(-900, 300, roll), lerp(0, 0.5, roll));
    const wp = easeIO(inv(EV.chokes + 0.25, EV.chokes + 0.6, t));
    const p1 = path([[-2100, 330, 1500], [-1300, 300, 1900]], roll), p2 = V(640, 250, 1640);
    const t1 = AF.H.all.position.clone().add(V(0, 120, 0)), t2 = V(470, 175, 1040);
    const sh = { pos: p1.clone().lerp(p2, wp).add(hand(t)), tgt: t1.clone().lerp(t2, wp), fov: 40, focus: t2, aperture: 2 * wp };
    const spit = EV.chokes + 0.35;
    if (t > spit) { const k = t - spit, list = []; for (let i = 0; i < 40; i++) { const a = (rnd(i) - 0.5) * 1.2, v = 300 + rnd(i + 3) * 300; const p = V(440 - Math.cos(a) * v * k, 330 + Math.sin(a) * v * k * 0.6 + 120 * k - 500 * k * k, 1040 + (rnd(i + 5) - 0.5) * 100 * k); if (p.y > 0) list.push({ p, s: 13 * (1 - clamp(k / 1.2)) + 4 }); } inst(AF.tea, list); }
    sh.people = sc => { person(sc, { ...RIV, f: -1, mood: t > spit - 0.05 ? 'shock' : 'smug', arms: 'cup', gait: 'stand' }, 480, 0, 1040, 0.62, { res: 1.6 });
      for (let i = 0; i < 5; i++) person(sc, { ...ENG, coat: '#5a8ad8', f: 1, mood: 'happy', gait: 'walk', ph: t * 7 + i }, AF.H.all.position.x - 300 + i * 90, 0, AF.H.all.position.z + 380 + (i % 2) * 60, 0.42, { res: 0.8 }); };
    return sh;
  },
  // 5. the quote: dolly-zoom on the rival, tea cup in hand
  quote(t, lt, u) {
    airLook(LOOK.day, { t, sunDir: [0.4, 0.7, 0.9] }); placeJet(AF.R, 900, JET_Y, 400, 0); placeJet(AF.H, -1500, JET_Y, 300, 0.5);
    const k = easeIO(u), d = lerp(700, 420, k), f = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(40) / 2) * 700 / d) * 180 / Math.PI; // vertigo: dolly in, fov out
    const c = V(480, 200, 1040), a = lerp(0.25, -0.15, k);
    const sh = { pos: orbit([c.x, c.y, c.z], d, a, 30).add(hand(t)), tgt: c, fov: f, roll: lerp(0, -0.05, k), focus: c, aperture: 6 };
    sh.people = sc => person(sc, { ...RIV, f: -1, mood: t < EV.quote + 1 ? 'laugh' : 'smug', arms: 'cup', gait: 'stand', lean: Math.round(Math.sin(t * 20) * 0.04 * 100) / 100 }, c.x, 0, c.z, 0.62, { res: 2.2 });
    return sh;
  },
  // 6. "But it gets weirder": rolling orbit around the calm hero
  weird(t, lt, u) {
    airLook(LOOK.dusk, { t, sunDir: [-0.8, 0.2, -0.3] }); placeJet(AF.H, -1500, JET_Y, 300, 0.5); placeJet(AF.R, 900, JET_Y, 400, 0);
    const c = V(-1300, 190, 900);
    const sh = { pos: orbit([c.x, c.y, c.z], 600, lerp(-0.8, 0.4, easeIO(u)), 40), tgt: c, fov: 38, roll: lerp(-0.25, -0.1, u), focus: c, aperture: 5 };
    sh.people = sc => person(sc, { ...HERO, f: 1, mood: 'smug', arms: 'back', gait: 'stand' }, c.x, 0, c.z, 0.62, { res: 2.0 });
    return sh;
  },
  // 7. night workshop: spiral orbit around the desk; a sheet rips from the corner on every "tear"
  paper(t, lt, u) {
    shopLook();
    const hx = 60, hz = 240, s = 1.25, k = easeIO(u);
    const pos = orbit([hx, 300, hz - 60], lerp(1500, 950, k), lerp(-0.9, 0.7, k), lerp(300, 60, k)).add(hand(t));
    const sh = { set: 'shop', pos, tgt: V(hx, 290, hz - 30), fov: 40, focus: V(hx, 280, hz), aperture: 3 };
    let pull = 0, tear = 0, kind = 'square'; const R3 = EV.rips;
    for (let i = 0; i < R3.length; i++) { const a = R3[i] - 0.45; if (t > a) { pull = sstep(a, R3[i], t); tear = clamp((t - R3[i]) / 0.35); kind = i === 1 ? 'round' : 'square'; } }
    if (kind === 'round') tear = -pull;
    // flying scraps after each rip
    const fly = []; for (const r of R3) { const q = t - r; if (q < 0 || q > 1.4) continue; for (let i = 0; i < 12; i++) fly.push({ p: V(hx + (rnd(i + r) - 0.5) * 400 * q, 170 + 260 * q - 380 * q * q, hz + 160 + (rnd(i + 2) - 0.5) * 300 * q), r: [q * 5 + i, q * 3, i], s: 1 }); }
    sh.people = sc => { const m = person(sc, { ...HERO, f: 1, mood: tear > 0 ? 'smug' : 'stern', arms: 'pull', pull: pull * 0.6, gait: 'stand' }, hx, 0, hz, s, { res: 2.0 });
      const hd = handsAt(hx, 0, hz, s, pull * 0.6); heldPaper(WS.paper, hd, kind, tear, 135);
      inst(WS.flying, fly); };
    return sh;
  },
  // 8. rival's jet rolls out: crowd, confetti, flashes; camera tracks alongside and overtakes
  rollout(t, lt, u) {
    airLook(LOOK.day, { t, sunDir: [-0.5, 0.6, 0.8] }); placeJet(AF.H, -2600, JET_Y, -900, 0); crackGeo(AF.R, 0);
    const jx = lerp(-1200, 900, easeOut(u)); placeJet(AF.R, jx, JET_Y, 400, 0);
    const pos = V(jx + lerp(-900, 700, easeIO(u)), lerp(160, 320, u), 2300).add(hand(t, 2)), tgt = V(jx + lerp(-200, 300, u), 260, 400);
    const sh = { pos, tgt, fov: 40, focus: V(jx, 260, 900), aperture: 1.5 };
    const cl = EV.claps; if (t > cl - 0.2) { const k = t - cl + 0.2, list = []; for (let i = 0; i < 220; i++) list.push({ p: V(jx - 900 + rnd(i) * 1800 + Math.sin(k * 3 + i) * 40, 1100 - k * (250 + rnd(i + 3) * 200) + rnd(i + 5) * 300, 900 + rnd(i + 7) * 900), r: [k * 4 + i, k * 3 + i * 2, 0], s: 1 }); inst(AF.confetti, list); }
    let fl = 0; for (let i = 0; i < 4; i++) fl = Math.max(fl, pulse(t, cl - 0.6 + i * 0.37, 0.02, 0.06) * 0.35); sh.flash = fl;
    sh.people = sc => { for (let i = 0; i < 18; i++) { const x = jx - 1100 + i * 130, z = 1250 + (i % 3) * 90; person(sc, { coat: CROWD[i % 6], hat: i % 4 ? undefined : 'cap', f: i % 2 ? 1 : -1, mood: t > cl - 0.3 ? 'laugh' : 'happy', arms: t > cl - 0.3 ? 'clap' : 'swing', clapT: Math.round(t * 30) / 30 + i, gait: 'stand' }, x, 0, z, 0.5, { res: 0.9 }); }
      person(sc, { ...RIV, f: -1, mood: 'proud', arms: 'hips', chin: 0.1, gait: 'walk', ph: t * 6 }, jx - 900, 0, 760, 0.6, { res: 1.4 }); };
    return sh;
  },
  // 9. both jets lowered into the giant tank: crane-down camera
  tank(t, lt, u) {
    tankLook(t); tankJets(t);
    const k = easeIO(u);
    const pos = path([[-2600, 3200, 4200], [-1200, 2200, 3600], [-200, 1300, 3000]], k).add(hand(t, 2));
    return { set: 'tank', pos, tgt: V(lerp(0, 0, k), lerp(1300, 700, k), 0), fov: 42, people: sc => { person(sc, { ...HERO, f: 1, mood: 'stern', arms: 'back' }, 700, THH + 20, TD / 2 + 80, 0.6, { res: 1.0, ground: THH + 20 }); person(sc, { ...RIV, f: -1, mood: 'smug', arms: 'hips' }, -900, THH + 20, TD / 2 + 80, 0.6, { res: 1.0, ground: THH + 20 }); } };
  },
  // 10. pressure cycles: fuselages breathe, counter spins, slow orbit over the tank
  pump(t, lt, u) {
    tankLook(t); tankJets(t);
    const k = easeIO(u), pos = orbit([0, 600, 0], lerp(3400, 2700, k), lerp(-0.5, 0.45, k), lerp(1700, 1250, k)).add(hand(t, 2));
    const pk = pumpK(t); TK.ripples.forEach((r, i) => { const q = ((t * 0.9 + i / 6) % 1); r.visible = true; r.position.set(i < 3 ? -150 : 150, WATER + 2, i < 3 ? -480 : 520); r.scale.set(900 + q * 900, 300 + q * 400, 1); r.material.opacity = 0.6 * (1 - q) * (0.4 + pk); });
    return { set: 'tank', pos, tgt: V(0, 560, 0), fov: 40, labels: [[V(-150, WATER + 420, -480), pk > 0.5 ? 'UP' : 'DOWN', 90, sstep(EV.updown[0] - 0.2, EV.updown[0], t) * (1 - sstep(EV.updown[1] + 0.6, EV.updown[1] + 0.9, t)), -0.05]], people: sc => { person(sc, { ...HERO, f: 1, mood: 'stern', arms: 'back' }, 700, THH + 20, TD / 2 + 80, 0.6, { res: 1.0, ground: THH + 20 }); person(sc, { ...RIV, f: -1, mood: 'smug', arms: 'hips' }, -900, THH + 20, TD / 2 + 80, 0.6, { res: 1.0, ground: THH + 20 }); } };
  },
  // 11. PSSH x3 (no voice): camera snaps closer on each exhale
  pssh(t, lt, u) {
    tankLook(t); tankJets(t);
    let step = 0; EV.pssh.forEach(p => step += sstep(p - 0.06, p + 0.08, t));
    const pos = V(-500 + step * 180, 1400 - step * 90, 2300 - step * 250).add(hand(t, 3)), tgt = V(-150, WATER + 60, -480);
    const pk = pumpK(t); const list = []; for (const p of EV.pssh) { const q = t - p; if (q < 0 || q > 0.6) continue; for (let i = 0; i < 30; i++) list.push({ p: V(-150 + (rnd(i) - 0.5) * 1400, WATER + 10 + q * (200 + rnd(i + 2) * 300) - 600 * q * q, -480 + (rnd(i + 4) - 0.5) * 300), s: 8 }); }
    inst(TK.drops, list);
    return { set: 'tank', pos, tgt, fov: 40, roll: 0.03 * Math.sin(step * 2) };
  },
  // 12. a hairline crack grows at the window corner: slow push-in to near-macro
  crack(t, lt, u) {
    tankLook(t); tankJets(t, 0.18 * sstep(EV.hairline - 0.1, EV.corner + 0.4, t));
    const j = TK.R.all.position, corner = V(j.x - 9, j.y + 8, j.z + R + 5), k = easeIO(u);
    const pos = corner.clone().add(V(lerp(500, 90, k), lerp(260, 40, k), lerp(900, 230, k))).add(hand(t, 0.6));
    return { set: 'tank', pos, tgt: corner.clone().add(V(lerp(60, 20, k), 0, 0)), fov: 38, focus: corner, aperture: lerp(4, 18, k), maxblur: 0.012, roll: lerp(0, 0.06, k) };
  },
  // 13. "Wait, what?": snap to the rival's face on the walkway
  what(t, lt, u) {
    tankLook(t); tankJets(t, 0.2);
    const c = V(-900, THH + 20 + 150, TD / 2 + 80), k = easeOut(inv(0, 0.25, lt));
    return { set: 'tank', pos: c.clone().add(V(lerp(-600, -200, k), lerp(200, 30, k), lerp(900, 420, k))), tgt: c, fov: 38, roll: 0.12, focus: c, aperture: 6,
      people: sc => person(sc, { ...RIV, f: 1, mood: 'shock', arms: 'up', gait: 'stand', sweat: true, sweatT: Math.round(t * 10) / 10 }, c.x, THH + 20, c.z, 0.62, { res: 2.2, ground: THH + 20 }) };
  },
  // 14. x-ray of the skin: pressure arrows push out; stress lines squeeze at square corners, glide round the circle
  flow(t, lt, u) {
    const k = easeIO(u), cl = sstep(EV.climbs - 0.2, EV.climbs + 0.3, t), fl = sstep(EV.flow - 0.6, EV.flow, t);
    LB.arrows.forEach((a, i) => { const q = pulse(t, EV.climbs + (i % 6) * 0.05, 0.1, 1.2) * cl; a.position.z = -400 + q * 220; a.setLength(200 + 200 * q, 80, 60); a.visible = cl > 0.05; });
    LB.lines.forEach(({ m, y0 }, i) => { const pts = [], ph = t * 0.6; const a = streamline(y0, -450, 0, 150, true), b = streamline(y0, 450, 0, 125, false); for (let j = 0; j < a.length; j++) { const x = a[j].x; pts.push(V(x, x < 0 ? a[j].y : b[j].y, 0)); } m.geometry.dispose(); m.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 4 + 2 * fl, 5); m.material.color.set(fl > 0.5 && Math.abs(y0) < 170 ? '#ffb0a0' : '#7fd0ff'); });
    LB.hot.forEach((h, i) => { const q = fl * (0.6 + 0.4 * Math.sin(t * 9 + i)); h.scale.setScalar(0.3 + q * 1.4); h.material.opacity = q; });
    const pos = orbit([0, 0, 0], lerp(3300, 2900, k), lerp(-0.35, 0.3, k), lerp(450, 150, k)).add(hand(t));
    return { set: 'lab', pos, tgt: V(lerp(-80, 80, k), 0, 0), fov: 40, labels: [[V(-360, 200, 60), 'SQUARE', 64, fl], [V(450, 200, 60), 'ROUND', 64, fl], [V(0, -330, 60), 'STRESS PILES UP', 54, fl, -0.03]] };
  },
  // 15. analogy: hero (whole body) pulls a round-hole sheet (holds) then a square-hole sheet (rips)
  tear(t, lt, u) {
    shopLook({ sunI: 0.9, hemiI: 0.8 });
    const hx = 60, hz = 240, s = 1.25, k = easeIO(u), swap = sstep(EV.holds + 0.5, EV.holds + 0.9, t);
    const pos = orbit([hx, 300, hz], lerp(1150, 900, k), lerp(-0.35, 0.35, k) + Math.sin(t * 0.7) * 0.05, lerp(150, 40, k)).add(hand(t));
    const sh = { set: 'shop', pos, tgt: V(hx, 290, hz), fov: 40, focus: V(hx, 280, hz), aperture: 3 };
    const kind = swap < 0.5 ? 'round' : 'square';
    const pullR = sstep(sceneT('tear')[0] + 0.6, EV.holds, t) * (1 - swap), pullS = sstep(EV.rips2 - 0.9, EV.rips2, t);
    const tear = kind === 'square' ? clamp((t - EV.rips2) / 0.3) : -pullR;
    const pull = kind === 'round' ? pullR : pullS;
    sh.labels = [[V(hx, 640, hz), kind === 'round' ? 'HOLDS!' : 'RIPS!', 90, kind === 'round' ? sstep(EV.holds - 0.1, EV.holds + 0.1, t) * (1 - swap) : sstep(EV.rips2, EV.rips2 + 0.15, t), -0.06]];
    const fly = []; const q = t - EV.rips2; if (q > 0 && q < 1.2) for (let i = 0; i < 14; i++) fly.push({ p: V(hx + (rnd(i) - 0.5) * 400 * q, 170 + 260 * q - 380 * q * q, hz + 60 + (rnd(i + 2) - 0.5) * 300 * q), r: [q * 5 + i, q * 3, i], s: 1 });
    sh.people = sc => { person(sc, { ...HERO, f: 1, mood: kind === 'round' && pull > 0.6 ? 'scared' : tear > 0 ? 'happy' : 'stern', sweat: kind === 'round' && pull > 0.6, sweatT: Math.round(t * 10) / 10, arms: 'pull', pull: pull * 0.6, gait: 'stand' }, hx, 0, hz, s, { res: 2.0 });
      heldPaper(WS.paper, handsAt(hx, 0, hz, s, pull * 0.6), kind, tear, 135); inst(WS.flying, fly); };
    return sh;
  },
  // 16. crack races, fuselage bursts, a wall of water hits the rival
  burst(t, lt, u) {
    tankLook(t);
    const cr = lerp(0.2, 1, sstep(EV.races - 0.1, EV.bursts, t)), b = easeOut(inv(EV.bursts, EV.bursts + 0.4, t));
    tankJets(t, cr, b);
    const sb = shake(t, EV.bursts, 40, 0.6), sw = shake(t, EV.blasts, 50, 0.7);
    const rv = V(-900, THH + 20, TD / 2 + 80);
    const toR = sstep(EV.blasts - 0.5, EV.blasts - 0.1, t);
    const pos = V(lerp(1200, -300, sstep(EV.races, EV.bursts, t)), lerp(1300, 1000, u), 2600).lerp(rv.clone().add(V(240, 260, 760)), toR).add(V(sb[0] + sw[0], sb[1] + sw[1], 0));
    const tgt = V(lerp(-100, -150, u), WATER + 80, -480).lerp(rv.clone().add(V(-60, 150, -200)), toR);
    // water: geyser from the split, then a wall toward the walkway
    const list = []; if (b > 0) { const q = t - EV.bursts; for (let i = 0; i < 260; i++) { const a = rnd(i) * Math.PI * 2, v = 400 + rnd(i + 3) * 900; list.push({ p: V(-120 + Math.cos(a) * v * q * 0.5, WATER + 100 + v * q * 0.9 - 900 * q * q, -480 + Math.sin(a) * v * q * 0.4 + q * 600), s: 10 + rnd(i) * 14 }); } }
    const wq = t - EV.blasts + 0.45; if (wq > 0) { for (let i = 0; i < 300; i++) { const x = -900 + (rnd(i * 2) - 0.5) * 1500, f = clamp(wq / 0.6); list.push({ p: V(x, WATER + 300 + rnd(i + 5) * 500 * f - 300 * wq * wq, lerp(-300, TD / 2 + 250, f) + rnd(i + 7) * 120), s: 14 + rnd(i) * 18 }); } TK.wall.visible = wq < 0.9; TK.wall.position.set(-900, WATER + 260, lerp(-200, TD / 2 + 140, clamp(wq / 0.6))); TK.wall.scale.set(900, 380 * (1 - clamp((wq - 0.5) / 0.4)), 120); }
    inst(TK.drops, list.slice(0, 700));
    const wet = t > EV.blasts + 0.05;
    return { set: 'tank', pos, tgt, fov: 42, roll: 0.06 * Math.sin(t * 4) * (b > 0 ? 1 : 0), people: sc => { person(sc, { ...RIV, f: 1, mood: wet ? 'shock' : 'scared', arms: wet ? 'up' : 'hips', gait: 'stand', wet, wetT: Math.round(t * 20) / 20, stache: wet ? 'droop' : 'handlebar', sweat: !wet && t > EV.races }, rv.x, THH + 20, rv.z, 0.62, { res: 1.6, ground: THH + 20 }); person(sc, { ...HERO, f: -1, mood: wet ? 'smug' : 'stern', arms: 'back' }, 700, THH + 20, TD / 2 + 80, 0.6, { res: 1.0, ground: THH + 20 }); } };
  },
  // 17. sunset: a round-window airliner banks past, camera orbits with it
  round2(t, lt, u) {
    airLook(LOOK.gold, { t, sunDir: [-0.9, 0.18, -0.4], center: V(0, 3000, 0) }); AF.F.all.visible = true; AF.R.all.visible = false; AF.H.all.visible = false;
    const jp = V(lerp(-1500, 1500, u), 3000 + Math.sin(u * 3) * 60, 0); placeJet(AF.F, jp.x, jp.y, jp.z, Math.PI, 0); AF.F.all.rotation.set(0, Math.PI, lerp(0.25, -0.15, u));
    const pos = orbit([jp.x, jp.y, jp.z], lerp(1900, 1250, easeIO(u)), lerp(0.9, -0.5, easeIO(u)), lerp(-300, 200, u));
    return { pos, tgt: jp.clone().add(V(0, 40, 0)), fov: 40, roll: lerp(0.12, -0.08, u) };
  },
  // 18. cabin: dolly back down the aisle; the rival leans as far from the window as he can. Hard cut.
  seat(t, lt, u) {
    const sh = { set: 'cabin', pos: V(lerp(-20, 30, u), lerp(260, 220, u), lerp(-300, -820, easeIO(u))), tgt: V(lerp(60, 40, u), 140, 1300), fov: 44, roll: Math.sin(t * 1.3) * 0.02, focus: V(110, 160, 400), aperture: 2 };
    sh.people = sc => {
      const SIT = -5 - 78 * 0.72; // hips on the cushion, legs hanging in front of it
      for (const s of CB.seats) { if (s.z > 1500 || s.z < camera.position.z + 520) continue; if (s.z === 400 && s.sd === 1) continue; if (rnd(s.z + s.sd * 7 + s.k) < 0.35) continue; person(sc, { coat: CROWD[Math.floor(rnd(s.z + s.k) * 6)], f: s.sd > 0 ? -1 : 1, mood: rnd(s.z) > 0.5 ? 'happy' : 'neutral', arms: 'stiff', gait: 'stand' }, s.seat.position.x, SIT, s.z, 0.72, { res: 1.0, noShadow: true }); }
      person(sc, { ...RIV, hat: undefined, f: -1, mood: 'scared', arms: 'stiff', gait: 'stand', sweat: true, sweatT: Math.round(t * 10) / 10, lean: -0.3 }, 100, SIT, 400, 0.72, { res: 1.8, noShadow: true });
    };
    sh.labels = [[V(312, 170, 440), '', 10, 0]];
    return sh;
  },
};
