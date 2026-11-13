// 3D environments (Three.js) with the 2D characters as billboards inside the scene.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = c => new THREE.Color(c);
let renderer, composer, renderPass, bokeh, GL;
const camera = new THREE.PerspectiveCamera(38, W / H, 5, 60000);
const SC = {}; // scenes
let GRAD, BRUSHTEX, STONETEX, WOODTEX, WAVETEX, BLOB;

// ---------- materials ----------
function canvasTex(w, h, f, rep = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function makeTex() {
  const g = new Uint8Array([70, 150, 255]); GRAD = new THREE.DataTexture(g, 3, 1, THREE.RedFormat); GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;
  const strokes = (g2, w, h, base, lo, hi, n, lw) => { g2.fillStyle = base; g2.fillRect(0, 0, w, h); for (let i = 0; i < n; i++) { const x = rnd(i) * w, y = rnd(i + 99) * h, l = 10 + rnd(i + 5) * 50, a = (rnd(i + 7) - 0.5) * 0.9, v = Math.floor(lo + rnd(i + 3) * (hi - lo)); g2.strokeStyle = `rgba(${v},${v},${v},0.5)`; g2.lineWidth = lw * (0.5 + rnd(i + 11)); g2.lineCap = 'round'; for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { g2.beginPath(); g2.moveTo(x + dx, y + dy); g2.lineTo(x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l); g2.stroke(); } } };
  BRUSHTEX = canvasTex(512, 512, (g2, w, h) => strokes(g2, w, h, '#e6e6e6', 200, 255, 1600, 8));
  STONETEX = canvasTex(512, 512, (g2, w, h) => { strokes(g2, w, h, '#e0e0e0', 190, 255, 900, 7); g2.strokeStyle = '#8a8a8a'; g2.lineWidth = 5; for (let y = 0; y < h; y += 64) { g2.beginPath(); g2.moveTo(0, y); g2.lineTo(w, y); g2.stroke(); for (let x = ((y / 64) % 2) * 64; x < w; x += 128) { g2.beginPath(); g2.moveTo(x, y); g2.lineTo(x, y + 64); g2.stroke(); } } });
  WOODTEX = canvasTex(256, 256, (g2, w, h) => { strokes(g2, w, h, '#e8e8e8', 170, 240, 300, 4); g2.strokeStyle = '#5a5a5a'; g2.lineWidth = 4; for (let x = 0; x < w; x += 32) { g2.beginPath(); g2.moveTo(x, 0); g2.lineTo(x, h); g2.stroke(); } });
  WAVETEX = canvasTex(512, 512, (g2, w, h) => { g2.fillStyle = '#d8d8d8'; g2.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { const x = rnd(i) * w, y = rnd(i + 5) * h, l = 30 + rnd(i + 2) * 60; g2.strokeStyle = 'rgba(255,255,255,.9)'; g2.lineWidth = 5; g2.lineCap = 'round'; g2.beginPath(); g2.moveTo(x - l, y); g2.quadraticCurveTo(x, y - 10, x + l, y); g2.stroke(); } });
  BLOB = canvasTex(128, 128, (g2) => { const r = g2.createRadialGradient(64, 64, 4, 64, 64, 62); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g2.fillStyle = r; g2.fillRect(0, 0, 128, 128); });
}
const toon = (color, map, rep) => { const m = new THREE.MeshToonMaterial({ color, gradientMap: GRAD }); if (map) { m.map = map.clone(); m.map.needsUpdate = true; if (rep) m.map.repeat.set(rep[0], rep[1]); } return m; };
const XRAY = new THREE.MeshBasicMaterial({ color: '#e9f4ff', wireframe: true });
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x14110f, side: THREE.BackSide });
function outline(mesh, w = 4) { // inverted hull
  const o = new THREE.Mesh(mesh.geometry, OUTLINE); o.scale.setScalar(1); o.userData.ow = w; o.onBeforeRender = () => {};
  const g = mesh.geometry; g.computeBoundingBox(); const s = g.boundingBox.getSize(V(0, 0, 0));
  o.scale.set((s.x + 2 * w) / Math.max(s.x, 1e-3), (s.y + 2 * w) / Math.max(s.y, 1e-3), (s.z + 2 * w) / Math.max(s.z, 1e-3));
  mesh.add(o); return mesh;
}
function mesh(geo, mat, x = 0, y = 0, z = 0, ow = 0, shadow = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; if (ow) outline(m, ow); return m; }

// ---------- noise / terrain ----------
const n2 = (x, z) => (noise(x * 0.37 + z * 0.11) + noise(z * 0.29 - x * 0.07 + 17)) * 0.5;
function terrainH(x, z) {
  const ax = Math.abs(x);
  let h = lerp(-330, 0, sstep(600, 840, ax));
  h += sstep(2000, 4200, ax) * (380 + 260 * n2(x / 900, z / 900));
  h += sstep(-2200, -6500, z) * (650 + 300 * n2(x / 1200, z / 700)) * sstep(500, 1100, ax + (z < -2600 ? 900 : 0));
  h += 14 * n2(x / 120, z / 120) * sstep(840, 1000, ax);
  return h;
}

// ---------- sky ----------
function skyDome() {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: C('#3a94ee') }, bot: { value: C('#c4ecff') }, sunDir: { value: V(0.3, 0.5, -1).normalize() }, sunCol: { value: C('#fff6c8') }, sunSize: { value: 0.03 }, night: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize((modelMatrix*vec4(position,1.)).xyz - cameraPosition); gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 top,bot,sunCol,sunDir; uniform float sunSize,night; varying vec3 vP;
      float h(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453);}
      void main(){ vec3 d=normalize(vP); float y=clamp(d.y*1.6+0.1,0.,1.); vec3 c=mix(bot,top,pow(y,0.8));
        float s=dot(d,normalize(sunDir)); c+=sunCol*smoothstep(1.-sunSize*6.,1.,s)*0.35; c=mix(c,sunCol,smoothstep(1.-sunSize*0.12,1.-sunSize*0.1,s));
        if(night>0.5){ vec3 q=floor(d*420.); if(h(q)>0.9985 && d.y>0.05) c+=vec3(1.,.97,.85)*0.9; }
        gl_FragColor=vec4(c,1.); }`
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(40000, 32, 16), m); s.renderOrder = -10; s.frustumCulled = false; return s;
}
function cloud(scale) {
  const g = new THREE.Group(), m = toon('#ffffff');
  [[-1.2, 0, 0, 0.7], [-0.4, 0.4, 0.1, 0.9], [0.6, 0.2, -0.1, 0.8], [1.4, -0.1, 0, 0.6], [0, -0.2, 0.3, 0.9]].forEach(([x, y, z, r]) => { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 100, 2), m); s.position.set(x * 100, y * 100, z * 100); g.add(s); });
  g.scale.setScalar(scale); g.userData.mat = m; return g;
}

// ---------- characters as billboards ----------
const SPR = { pool: [], used: 0, tex: new Map(), frame: 0 };
const BOX = { l: -230, r: 230, t: -520, b: 70 }; // drawing bounds in guy() units
function texFor(params, res) {
  const key = res + '|' + JSON.stringify(params, (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v);
  let e = SPR.tex.get(key);
  if (!e) {
    const cw = Math.ceil((BOX.r - BOX.l) * res), ch = Math.ceil((BOX.b - BOX.t) * res);
    // reuse a stale canvas of same size if possible
    let old = null; for (const [k, v] of SPR.tex) if (v.frame < SPR.frame - 1 && v.cw === cw && v.ch === ch) { old = v; SPR.tex.delete(k); break; }
    e = old || { cv: Object.assign(document.createElement('canvas'), { width: cw, height: ch }), cw, ch };
    if (!e.tex) { e.tex = new THREE.CanvasTexture(e.cv); e.tex.colorSpace = THREE.SRGBColorSpace; e.tex.anisotropy = 4; }
    const g = e.cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cw, ch); g.setTransform(res, 0, 0, res, -BOX.l * res, -BOX.t * res);
    guy(g, { ...params, x: 0, y: 0, s: 1, rot: 0 }); e.tex.needsUpdate = true;
    SPR.tex.set(key, e);
  }
  e.frame = SPR.frame; return e.tex;
}
function spriteMesh() {
  if (SPR.used < SPR.pool.length) return SPR.pool[SPR.used++];
  const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.45, side: THREE.DoubleSide, fog: true }));
  m.castShadow = true; m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: 0.45 });
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: BLOB, transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.renderOrder = 1;
  m.userData.sh = sh; SPR.pool.push(m); SPR.used++; return m;
}
let SPRITE_TINT = C('#ffffff');
// place a character: feet at (x,y,z); s = world scale; res = texture px per unit
function person(scene, p, x, y, z, s, o = {}) {
  const res = o.res || clamp(s * 0.9, 0.25, 2.4);
  const tex = texFor({ ...p, s: undefined }, res), m = spriteMesh();
  m.material.map = tex; m.material.color.copy(o.tint || SPRITE_TINT); m.material.needsUpdate = true;
  m.customDepthMaterial.map = tex;
  const w = (BOX.r - BOX.l) * s, h = (BOX.b - BOX.t) * s;
  m.scale.set(w, h, 1);
  // geometry origin is bottom-centre; shift so the feet (guy y=0) land on (x,y,z)
  const feet = BOX.b * s;
  m.position.set(x, y - feet, z);
  // cylindrical billboard
  m.rotation.set(0, Math.atan2(camera.position.x - x, camera.position.z - z), 0);
  m.rotateZ(-(p.rot || 0));
  scene.add(m);
  const sh = m.userData.sh; sh.position.set(x, (o.ground ?? y) + 1.5, z); sh.scale.set(150 * s, 70 * s, 1); sh.material.opacity = o.noShadow ? 0 : 1; scene.add(sh);
  return m;
}
function resetSprites() { for (const m of SPR.pool) { m.parent && m.parent.remove(m); m.userData.sh.parent && m.userData.sh.parent.remove(m.userData.sh); } SPR.used = 0; SPR.frame++; }

// ---------- lights per scene ----------
function addLights(sc) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x556644, 1.1); sc.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc2 = sun.shadow.camera; sc2.left = -2200; sc2.right = 2200; sc2.top = 2200; sc2.bottom = -2200; sc2.near = 100; sc2.far = 12000; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 2;
  sc.add(sun); sc.add(sun.target);
  sc.userData.hemi = hemi; sc.userData.sun = sun;
  const sky = skyDome(); sc.add(sky); sc.userData.sky = sky;
  sc.fog = new THREE.Fog(0xc4ecff, 3000, 26000);
}
function applyLook(sc, L, o = {}) {
  const u = sc.userData.sky.material.uniforms; u.top.value.set(L.skyT); u.bot.value.set(L.skyB); u.sunCol.value.set(L.sun); u.night.value = o.night ? 1 : 0;
  const sd = V(...(o.sunDir || [0.45, 0.55, -1])).normalize(); u.sunDir.value.copy(sd);
  const sun = sc.userData.sun; sun.position.copy(sd.clone().multiplyScalar(6000)).add(V(0, 0, 0)); sun.target.position.set(0, 0, 0);
  sun.color.set(o.night ? '#7d86d9' : L.tint === '#fff3d0' ? '#fff4dc' : mixHex(L.sun, '#ffffff', 0.3)); sun.intensity = o.night ? 0.5 : (L.skyT === LOOKS.storm.skyT ? 1.1 : 2.2);
  sc.userData.hemi.color.set(mixHex(L.skyB, '#ffffff', 0.4)); sc.userData.hemi.groundColor.set(L.groundD); sc.userData.hemi.intensity = o.night ? 0.55 : 1.15;
  sc.fog.color.set(L.skyB); sc.fog.near = o.fogNear ?? 3500; sc.fog.far = o.fogFar ?? 24000;
  SPRITE_TINT = C(o.night ? '#9aa0d8' : mixHex('#ffffff', L.tint, L.tintA * 2.2));
}

// ================= VALLEY =================
const VAL = {};
function buildValley() {
  const sc = new THREE.Scene(); addLights(sc); SC.valley = sc;
  // terrain
  const tg = new THREE.PlaneGeometry(26000, 26000, 220, 220); tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position; for (let i = 0; i < pos.count; i++) pos.setY(i, terrainH(pos.getX(i), pos.getZ(i)));
  tg.computeVertexNormals();
  VAL.groundMat = toon('#7fc45a', BRUSHTEX, [40, 40]);
  const terr = mesh(tg, VAL.groundMat, 0, 0, 0, 0, false); terr.receiveShadow = true; sc.add(terr);
  // road on the banks
  VAL.roadMat = toon('#c9a875', BRUSHTEX, [8, 1]);
  for (const sx of [-1, 1]) sc.add(mesh(new THREE.BoxGeometry(1500, 4, 150), VAL.roadMat, sx * 1560, 0, 0, 0, false));
  // river
  VAL.waterMat = new THREE.MeshPhongMaterial({ color: '#3ea2d6', shininess: 90, specular: 0x88aacc, map: WAVETEX.clone() }); VAL.waterMat.map.repeat.set(3, 24); VAL.waterMat.map.needsUpdate = true;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1900, 26000), VAL.waterMat); water.rotation.x = -Math.PI / 2; water.position.y = -230; water.receiveShadow = true; sc.add(water); VAL.water = water;
  // rocks
  const rock = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), toon('#c9b99b', STONETEX), 80); const d = new THREE.Object3D();
  for (let i = 0; i < 80; i++) { const sd = i % 2 ? 1 : -1, z = -3000 + rnd(i) * 7000, x = sd * (600 + rnd(i + 3) * 220); d.position.set(x, terrainH(x, z) - 10, z); const s = 25 + rnd(i + 7) * 45; d.scale.set(s, s * 0.6, s); d.rotation.set(rnd(i), rnd(i + 1) * 3, 0); d.updateMatrix(); rock.setMatrixAt(i, d.matrix); }
  rock.castShadow = rock.receiveShadow = true; sc.add(rock); VAL.rockMat = rock.material;
  // trees (instanced trunks + crowns)
  const NT = 240, trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(10, 14, 90, 6), toon('#6b4426'), NT), crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), toon('#5fae52', BRUSHTEX), NT * 2);
  let ti = 0, ci = 0;
  for (let i = 0; i < 900 && ti < NT; i++) {
    const x = (rnd(i * 3) - 0.5) * 16000, z = 1500 - rnd(i * 3 + 1) * 14000; if (Math.abs(x) < 900 || (Math.abs(x) < 2300 && Math.abs(z) < 260) || (z > -700 && Math.abs(x) < 1700)) continue;
    const y = terrainH(x, z), s = 0.8 + rnd(i + 5) * 0.9;
    d.position.set(x, y + 45 * s, z); d.scale.set(s, s, s); d.rotation.set(0, 0, 0); d.updateMatrix(); trunk.setMatrixAt(ti++, d.matrix);
    d.position.set(x, y + 150 * s, z); d.scale.set(70 * s, 85 * s, 70 * s); d.updateMatrix(); crown.setMatrixAt(ci++, d.matrix);
    d.position.set(x + 25 * s, y + 200 * s, z + 10); d.scale.set(45 * s, 55 * s, 45 * s); d.updateMatrix(); crown.setMatrixAt(ci++, d.matrix);
  }
  trunk.count = ti; crown.count = ci; for (const m of [trunk, crown]) { m.castShadow = m.receiveShadow = true; sc.add(m); } VAL.crownMat = crown.material;
  // little town on the far hills
  const NH = 26, house = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), toon('#f1e2c4', BRUSHTEX), NH), roof = new THREE.InstancedMesh(new THREE.ConeGeometry(0.8, 0.6, 4), toon('#c0583c'), NH);
  for (let i = 0; i < NH; i++) { const x = -2600 + i * 200 + rnd(i) * 80, z = -5200 - rnd(i + 4) * 1200, y = terrainH(x, z), s = 90 + rnd(i + 2) * 60; d.position.set(x, y + s / 2, z); d.scale.set(s, s, s * 0.9); d.rotation.set(0, rnd(i) * 0.5, 0); d.updateMatrix(); house.setMatrixAt(i, d.matrix); d.position.set(x, y + s * 1.3, z); d.scale.set(s, s, s); d.rotation.set(0, Math.PI / 4 + rnd(i) * 0.5, 0); d.updateMatrix(); roof.setMatrixAt(i, d.matrix); }
  for (const m of [house, roof]) { m.castShadow = m.receiveShadow = true; sc.add(m); }
  // clouds
  VAL.clouds = []; for (let i = 0; i < 12; i++) { const c = cloud(2 + rnd(i) * 2.5); c.position.set((rnd(i + 3) - 0.5) * 16000, 2600 + rnd(i + 6) * 1800, -5000 - rnd(i + 9) * 9000); sc.add(c); VAL.clouds.push(c); }
  // grass tufts along banks (foreground depth)
  const NG = 1400, grass = new THREE.InstancedMesh(new THREE.ConeGeometry(5, 1, 3), toon('#4f9a3f'), NG);
  for (let i = 0; i < NG; i++) { const sd = i % 2 ? 1 : -1, z = -800 + rnd(i * 2) * 3600, x = sd * (780 + rnd(i * 2 + 1) * 900); if (Math.abs(z) < 120) continue; const h = 30 + rnd(i + 9) * 60; d.position.set(x, terrainH(x, z) + h / 2, z); d.scale.set(1 + rnd(i) , h, 1); d.rotation.set((rnd(i + 3) - 0.5) * 0.5, 0, (rnd(i + 4) - 0.5) * 0.5); d.updateMatrix(); grass.setMatrixAt(i, d.matrix); }
  grass.receiveShadow = true; sc.add(grass); VAL.grassMat = grass.material;
  buildBridge(sc);
  buildProps(sc);
}
// ---------- the chain bridge ----------
const BR = {};
const NSEG = 50, SEGL = (X1 - X0) / NSEG;
function buildBridge(sc) {
  BR.stone = toon('#c9b99b', STONETEX, [1, 3]);
  for (const x of [-760, 760]) {
    const g = new THREE.Group(); g.position.x = x;
    for (const z of [-92, 92]) g.add(mesh(new THREE.BoxGeometry(150, 860, 56), BR.stone, 0, 70, z, 5));
    g.add(mesh(new THREE.BoxGeometry(170, 50, 250), BR.stone, 0, 520, 0, 5));
    g.add(mesh(new THREE.BoxGeometry(150, 40, 200), BR.stone, 0, 240, 0, 4));
    sc.add(g); g.traverse(o => o.layers.enable(1));
  }
  const wood = toon('#c98f55', WOODTEX, [1, 1]), dark = toon('#7a4a28', WOODTEX), iron = toon('#2a2a33');
  const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = m.receiveShadow = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.layers.enable(1); sc.add(m); return m; };
  BR.deck = mk(new THREE.BoxGeometry(SEGL + 1, 10, 130), wood, NSEG);
  BR.beam = mk(new THREE.BoxGeometry(SEGL + 1, 26, 10), dark, NSEG * 2);
  BR.rail = mk(new THREE.BoxGeometry(SEGL + 1, 6, 6), dark, NSEG * 2);
  BR.post = mk(new THREE.BoxGeometry(6, 58, 6), dark, NSEG * 2);
  BR.link = mk(new THREE.TorusGeometry(11, 3.6, 5, 10), iron, 2 * 110);
  BR.hang = mk(new THREE.CylinderGeometry(2.2, 2.2, 1, 5), iron, 2 * 20);
  BR.stay = mk(new THREE.CylinderGeometry(6, 6, 1, 6), iron, 4);
  // the bolt plate used for macro shots (front side, x = -40)
  BR.plate = new THREE.Group(); const pm = toon('#6a6a7a', STONETEX), bm = toon('#c4c4d0');
  BR.plate.add(mesh(new THREE.BoxGeometry(46, 40, 8), pm, 0, 0, 0, 1.5));
  BR.bolts = [mesh(new THREE.CylinderGeometry(6.5, 6.5, 8, 10), bm, -11, 0, 6, 1.2), mesh(new THREE.CylinderGeometry(6.5, 6.5, 8, 10), bm, 11, 0, 6, 1.2)];
  BR.bolts.forEach(b => { b.rotation.x = Math.PI / 2; BR.plate.add(b); });
  sc.add(BR.plate);
  BR.flagMat = []; BR.bunting = new THREE.Group(); sc.add(BR.bunting);
  const cols = ['#e8473d', '#ffd34d', '#3f72dc'];
  for (let i = 0; i < 26; i++) { const x = -720 + i * 57.6, y = 540 - 100 * (1 - (x / 760) ** 2); const f = new THREE.Mesh(new THREE.ConeGeometry(16, 40, 3), toon(cols[i % 3])); f.position.set(x, y - 22, 92); f.rotation.x = Math.PI; BR.bunting.add(f); }
  // flying bolt + sparks for the snap
  BR.flyBolt = mesh(new THREE.CylinderGeometry(5, 5, 50, 10), bm, 0, 0, 0, 1.2); sc.add(BR.flyBolt);
  BR.xrayObjs = [];
  BR.sparks = mk(new THREE.BoxGeometry(1, 1, 14), new THREE.MeshBasicMaterial({ color: '#ffd34d' }), 24);
}
const _o = new THREE.Object3D();
function setI(im, i, x, y, z, rz = 0, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0) { _o.position.set(x, y, z); _o.rotation.set(rx, ry, rz); _o.scale.set(sx, sy, sz); _o.updateMatrix(); im.setMatrixAt(i, _o.matrix); }
// 3D deck point: 2D helper gives y-down, flip it
function dp(B, x) { const d = deckPt(B, x); return { x: d.x, y: -d.y, a: -d.a }; }
function chainPt(B, x) { let y = chainY(B, x); if (B.snapped && x > 0) y += B.snapped * (x / 760) * 520 * (1 - Math.abs(x / 760 - 0.5)); return -y + 30; }
function cylBetween(im, i, a, b) { const d = b.clone().sub(a), L = d.length(); _o.position.copy(a).add(b).multiplyScalar(0.5); _o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); _o.scale.set(1, L, 1); _o.updateMatrix(); im.setMatrixAt(i, _o.matrix); }
function updateBridge(B, t) {
  for (let i = 0; i < NSEG; i++) {
    const x = X0 + (i + 0.5) * SEGL, p = dp(B, x);
    setI(BR.deck, i, p.x, p.y - 5, 0, p.a);
    for (const [k, z] of [[0, -66], [1, 66]]) {
      setI(BR.beam, i * 2 + k, p.x, p.y - 18, z, p.a);
      setI(BR.rail, i * 2 + k, p.x - Math.sin(p.a) * 58, p.y + 58 * Math.cos(p.a), z, p.a);
      setI(BR.post, i * 2 + k, p.x - Math.sin(p.a) * 29, p.y + 29 * Math.cos(p.a), z, p.a, i % 2 ? 0.001 : 1, 1, 1);
    }
  }
  // chains made of links
  let li = 0;
  for (const z of [-80, 80]) for (let k = 0; k < 110; k++) {
    const x = -760 + k * 13.95, y = chainPt(B, x), y2 = chainPt(B, x + 2), a = Math.atan2(y2 - y, 2);
    setI(BR.link, li++, x, y, z, a, 1, 1, 1, 0, k % 2 ? Math.PI / 2 : 0);
  }
  let hi = 0;
  for (const z of [-80, 80]) for (let k = 0; k < 20; k++) {
    const x = X0 + 35 + k * 70, cy = chainPt(B, x), p = dp(B, x);
    if (B.snapped && x > -60) cylBetween(BR.hang, hi++, V(x, cy, z), V(x + 12 * B.snapped, cy - 70, z));
    else cylBetween(BR.hang, hi++, V(x, cy, z), V(p.x, p.y + 6, z * 0.86));
  }
  let si = 0; for (const sx of [-1, 1]) for (const z of [-80, 80]) cylBetween(BR.stay, si++, V(sx * 760, chainPt(B, sx * 760), z), V(sx * 1250, -5, z * 1.1));
  for (const im of [BR.deck, BR.beam, BR.rail, BR.post, BR.link, BR.hang, BR.stay]) im.instanceMatrix.needsUpdate = true;
  // plate sits at the hanger near x=-35 on the front beam
  const pp = dp(B, -35); BR.plate.position.set(pp.x, pp.y - 8, 74); BR.plate.rotation.z = pp.a;
  BR.flyBolt.visible = false; BR.sparks.count = 0;
}
// ---------- props in the valley (board, swing tree, fire...) ----------
const PR = {};
function buildProps(sc) {
  // notice board on the left bank
  PR.board = new THREE.Group(); PR.board.position.set(-1150, 0, 330);
  PR.board.add(mesh(new THREE.BoxGeometry(18, 420, 18), toon('#6b4426'), 0, 210, 0, 3));
  PR.board.add(mesh(new THREE.BoxGeometry(360, 260, 16), toon('#8a5a32', WOODTEX), 0, 400, 0, 4));
  PR.paperCv = document.createElement('canvas'); PR.paperCv.width = 640; PR.paperCv.height = 440; PR.paperTex = new THREE.CanvasTexture(PR.paperCv); PR.paperTex.colorSpace = THREE.SRGBColorSpace;
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(320, 220), new THREE.MeshToonMaterial({ map: PR.paperTex, gradientMap: GRAD })); paper.position.set(0, 400, 9); paper.receiveShadow = true; PR.board.add(paper);
  sc.add(PR.board);
  // swing tree on the left bank, downstream
  PR.tree = new THREE.Group(); PR.tree.position.set(-1500, 0, 1200);
  const bark = toon('#6b4426', BRUSHTEX, [1, 3]);
  PR.tree.add(mesh(new THREE.CylinderGeometry(45, 70, 1300, 8), bark, -650, 650, -320, 4));
  const br = mesh(new THREE.CylinderGeometry(26, 34, 1300, 8), bark, -100, 1240, -150, 3); br.quaternion.setFromUnitVectors(V(0, 1, 0), V(1150, 20, 330).normalize()); PR.tree.add(br);
  const leaf = toon('#5fae52', BRUSHTEX);
  for (let i = 0; i < 9; i++) { const s = mesh(new THREE.IcosahedronGeometry(260 + rnd(i) * 90, 1), leaf, -800 + i * 150, 1480 + rnd(i + 2) * 160, -320 + (rnd(i + 5) - 0.2) * 300, 5); PR.tree.add(s); }
  PR.ropes = [0, 1].map(() => { const m = mesh(new THREE.CylinderGeometry(3, 3, 1, 5), toon('#3a2618'), 0, 0, 0, 0); PR.tree.add(m); return m; });
  PR.seat = mesh(new THREE.BoxGeometry(170, 18, 70), toon('#a0602c', WOODTEX), 0, 0, 0, 3); PR.tree.add(PR.seat);
  sc.add(PR.tree);
  // campfire + laundry line on the right bank
  PR.fire = new THREE.Group(); PR.fire.position.set(1000, 0, 420);
  for (const a of [0.5, -0.5, 1.6]) { const l = mesh(new THREE.CylinderGeometry(14, 14, 230, 8), toon('#5a3a20', WOODTEX), 0, 14, 0, 3); l.rotation.set(Math.PI / 2, a, 0); l.rotation.order = 'YXZ'; l.rotation.set(Math.PI / 2, 0, 0); l.rotateOnWorldAxis(V(0, 1, 0), a); PR.fire.add(l); }
  PR.flames = ['#ff6a2a', '#ffa83a', '#ffe17a'].map((c, i) => { const f = new THREE.Mesh(new THREE.ConeGeometry(60 - i * 15, 220 - i * 40, 8), new THREE.MeshBasicMaterial({ color: c })); f.position.y = 110 - i * 15; PR.fire.add(f); return f; });
  PR.fireLight = new THREE.PointLight('#ff9a3c', 0, 2400, 1.2); PR.fireLight.position.set(0, 160, 0); PR.fire.add(PR.fireLight);
  PR.line = new THREE.Group(); PR.line.position.set(1000, 0, 250);
  for (const x of [-420, 420]) PR.line.add(mesh(new THREE.CylinderGeometry(7, 7, 420, 6), toon('#6b4426'), x, 210, 0, 2));
  const ln = mesh(new THREE.CylinderGeometry(1.5, 1.5, 840, 4), toon('#ddd2c0'), 0, 405, 0, 0); ln.rotation.z = Math.PI / 2; PR.line.add(ln);
  const coat = mesh(new THREE.CapsuleGeometry(70, 110, 6, 12), toon('#d8423d', BRUSHTEX), 120, 290, 0, 4); coat.scale.z = 0.35; PR.line.add(coat);
  PR.drips = [0, 1, 2, 3].map(i => { const d = new THREE.Mesh(new THREE.SphereGeometry(6, 6, 6), new THREE.MeshBasicMaterial({ color: '#7fd0ff' })); PR.line.add(d); return d; });
  PR.stick = mesh(new THREE.CylinderGeometry(5, 5, 560, 6), toon('#6b4426'), 0, 0, 0, 1.5); PR.fire.add(PR.stick); PR.stick.position.set(-60, 210, -40); PR.stick.rotation.z = 1.1;
  PR.bootMeshes = [-80, 60].map(x => { const g = new THREE.Group(); const bm = toon('#1b1a20'); const leg = mesh(new THREE.CylinderGeometry(20, 22, 90, 10), bm, 0, -45, 0, 2); const toe = mesh(new THREE.BoxGeometry(70, 26, 40), bm, 22, -96, 0, 2); g.add(leg, toe); g.rotation.z = Math.PI; PR.fire.add(g); return g; });
  sc.add(PR.fire, PR.line);
  PR.splashes = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), new THREE.MeshBasicMaterial({ color: '#e8f8ff' }), 200); PR.splashes.count = 0; sc.add(PR.splashes);
  PR.ripples = [0, 1, 2, 3].map(() => { const r = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; sc.add(r); return r; });
  PR.duck = new THREE.Group(); { const wm = toon('#fff7e6'), om = toon('#ff9a2e');
    const b = mesh(new THREE.SphereGeometry(40, 16, 12), wm, 0, 0, 0, 3); b.scale.set(1.5, 0.8, 1); PR.duck.add(b);
    PR.duck.add(mesh(new THREE.SphereGeometry(24, 14, 10), wm, 40, 42, 0, 3));
    PR.duckBeak = mesh(new THREE.ConeGeometry(9, 26, 8), om, 66, 40, 0, 2); PR.duckBeak.rotation.z = -Math.PI / 2; PR.duck.add(PR.duckBeak);
    for (const z of [-12, 12]) PR.duck.add(mesh(new THREE.SphereGeometry(3.5, 6, 6), new THREE.MeshBasicMaterial({ color: '#14110f' }), 54, 50, z, 0));
    const tail = mesh(new THREE.ConeGeometry(14, 30, 6), wm, -62, 14, 0, 2); tail.rotation.z = 1.1; PR.duck.add(tail); }
  sc.add(PR.duck);
  PR.shako = new THREE.Group(); PR.shako.add(mesh(new THREE.CylinderGeometry(22, 18, 40, 10), toon('#1d2140'), 0, 0, 0, 2), mesh(new THREE.SphereGeometry(12, 8, 6), toon('#ffd34d'), 0, 30, 0, 2)); sc.add(PR.shako);
}
function drawPaper(stamp) {
  const g = PR.paperCv.getContext('2d'); g.fillStyle = '#f6ecd2'; g.fillRect(0, 0, 640, 440); g.fillStyle = '#3a2618'; g.textAlign = 'center';
  g.font = '800 70px Baloo2'; g.fillText('BY ORDER', 320, 100); g.font = '700 50px Baloo2'; ['ALL TROOPS SHALL', 'BREAK STEP', 'ON BRIDGES'].forEach((s, i) => g.fillText(s, 320, 175 + i * 62));
  if (stamp > 0) { g.save(); g.translate(400, 360); g.rotate(-0.18); const s = lerp(2.4, 1, stamp); g.scale(s, s); g.globalAlpha = stamp; g.strokeStyle = '#d8423d'; g.lineWidth = 10; g.strokeRect(-170, -50, 340, 100); g.fillStyle = '#d8423d'; g.font = '900 62px Montserrat'; g.fillText('APPROVED', 0, 22); g.restore(); }
  PR.paperTex.needsUpdate = true;
}
function hideProps(keep = []) { for (const k of ['board', 'tree', 'fire', 'line', 'shako', 'duck']) PR[k].visible = keep.includes(k); BR.bunting.visible = keep.includes('bunting'); PR.splashes.count = 0; PR.ripples.forEach(r => r.visible = false); PR.fireLight.intensity = 0; }

// ================= other sets =================
const PA = {}, BO = {}, GE = {}, GU = {};
function buildParade() {
  const sc = new THREE.Scene(); addLights(sc); SC.parade = sc;
  sc.add(mesh(new THREE.PlaneGeometry(20000, 20000).rotateX(-Math.PI / 2), toon('#dcc28c', BRUSHTEX, [30, 30]), 0, 0, 0, 0, false));
  const g = new THREE.Group(); g.position.set(0, 0, -900); sc.add(g);
  const wall = toon('#e9dcc0', BRUSHTEX, [3, 2]);
  g.add(mesh(new THREE.BoxGeometry(1900, 700, 300), wall, 0, 350, -150, 6));
  for (let i = 0; i < 8; i++) g.add(mesh(new THREE.CylinderGeometry(34, 38, 640, 14), toon('#fbf4e4', BRUSHTEX), -770 + i * 220, 320, 40, 4));
  g.add(mesh(new THREE.BoxGeometry(2000, 50, 360), wall, 0, 700, -120, 5));
  const ped = new THREE.Shape(); ped.moveTo(-1000, 0); ped.lineTo(0, 330); ped.lineTo(1000, 0); ped.lineTo(-1000, 0);
  const pg = new THREE.ExtrudeGeometry(ped, { depth: 60, bevelEnabled: false }); const pm = mesh(pg, toon('#f3e8d0', BRUSHTEX, [0.002, 0.002]), 0, 725, 10, 6); g.add(pm);
  const tc = document.createElement('canvas'); tc.width = 512; tc.height = 200; const tg = tc.getContext('2d'); tg.font = '900 170px Baloo2'; tg.textAlign = 'center'; tg.fillStyle = '#7a5a3a'; tg.fillText('1831', 256, 165);
  const tt = new THREE.CanvasTexture(tc); tt.colorSpace = THREE.SRGBColorSpace;
  const tm = new THREE.Mesh(new THREE.PlaneGeometry(460, 180), new THREE.MeshBasicMaterial({ map: tt, transparent: true })); tm.position.set(0, 830, 72); g.add(tm);
  g.add(mesh(new THREE.CylinderGeometry(8, 8, 420, 6), toon('#3a2618'), 0, 1250, 40, 2));
  PA.flag = new THREE.Mesh(new THREE.PlaneGeometry(240, 150, 16, 4), toon('#3f72dc')); PA.flag.material.side = THREE.DoubleSide; PA.flag.position.set(120, 1380, 40); PA.flag.castShadow = true; g.add(PA.flag); PA.flagBase = PA.flag.geometry.attributes.position.array.slice();
  PA.clouds = []; for (let i = 0; i < 6; i++) { const c = cloud(2 + rnd(i) * 2); c.position.set((rnd(i) - 0.5) * 9000, 2600 + rnd(i + 4) * 1200, -6000 - rnd(i + 2) * 3000); sc.add(c); }
}
function waveFlag(f, base, t, amp = 14) { const p = f.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = base[i * 3] + 120; p.setZ(i, Math.sin(t * 6 - x * 0.03) * amp * (x / 240)); } p.needsUpdate = true; f.geometry.computeVertexNormals(); }
function buildBoots() {
  const sc = new THREE.Scene(); addLights(sc); SC.boots = sc;
  const cob = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#9c8a66'; g.fillRect(0, 0, w, h); for (let r = 0; r < 8; r++) for (let k = 0; k < 8; k++) { g.beginPath(); g.ellipse(k * 64 + (r % 2) * 32 + 32, r * 64 + 32, 28, 26, 0, 0, Math.PI * 2); g.fillStyle = ['#cdbd98', '#c2b28c', '#d6c7a3'][(r + k) % 3]; g.fill(); g.lineWidth = 4; g.strokeStyle = '#7e6c4c'; g.stroke(); } }, [30, 30]);
  sc.add(mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ map: cob, gradientMap: GRAD }), 0, 0, 0, 0, false));
  const wall = toon('#e9dcc0', BRUSHTEX, [3, 1]); sc.add(mesh(new THREE.BoxGeometry(4000, 700, 100), wall, 0, 350, -1400, 0));
  for (let i = 0; i < 16; i++) sc.add(mesh(new THREE.CylinderGeometry(34, 38, 640, 12), toon('#fbf4e4'), -1800 + i * 240, 320, -1320, 0));
  // boot billboards are drawn with boot() into textures
  BO.cv = []; BO.mesh = [];
  for (let i = 0; i < 13; i++) {
    const cv = document.createElement('canvas'); cv.width = 300; cv.height = 520; const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 80, 500); boot(g, 0, 0, 1.15, '#e9e4d8'); tx.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(300, 520).translate(70, 260 - 20, 0), new THREE.MeshBasicMaterial({ map: tx, alphaTest: 0.4, side: THREE.DoubleSide }));
    m.castShadow = true; m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: 0.4, map: tx }); sc.add(m); BO.mesh.push(m);
  }
  BO.dust = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), toon('#e3d3b0'), 120); BO.dust.count = 0; sc.add(BO.dust);
}
function buildGeneral() {
  const sc = new THREE.Scene(); addLights(sc); SC.general = sc;
  sc.add(mesh(new THREE.PlaneGeometry(20000, 20000).rotateX(-Math.PI / 2), toon('#7fc45a', BRUSHTEX, [30, 30]), 0, 0, 0, 0, false));
  sc.add(mesh(new THREE.CylinderGeometry(10, 10, 1400, 8), toon('#3a2618'), -500, 700, -700, 2));
  GE.flag = new THREE.Mesh(new THREE.PlaneGeometry(520, 320, 20, 6), toon('#3f72dc')); GE.flag.material.side = THREE.DoubleSide; GE.flag.position.set(-240, 1220, -700); sc.add(GE.flag); GE.flagBase = GE.flag.geometry.attributes.position.array.slice();
  for (let i = 0; i < 12; i++) sc.add(mesh(new THREE.BoxGeometry(260, 380, 30), toon('#d8c9a8'), -1800 + i * 330, 190, -1600, 0));
}
function buildGuitar() {
  const sc = new THREE.Scene(); SC.guitar = sc;
  sc.background = C('#2b1a12');
  sc.add(new THREE.HemisphereLight(0xfff0d8, 0x402010, 1.2)); const key = new THREE.DirectionalLight(0xffe2b0, 2.4); key.position.set(500, 800, 900); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -1500, right: 1500, top: 1500, bottom: -1500, near: 10, far: 4000 }); sc.add(key);
  const body = new THREE.Shape(); body.ellipse(0, 0, 900, 1100, 0, Math.PI * 2);
  const hole = new THREE.Path(); hole.absarc(0, 420, 260, 0, Math.PI * 2, true); body.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(body, { depth: 80, bevelEnabled: true, bevelSize: 20, bevelThickness: 20, bevelSegments: 3 });
  const top = new THREE.MeshToonMaterial({ color: '#e8a35a', gradientMap: GRAD, map: BRUSHTEX.clone() }); top.map.repeat.set(0.004, 0.004); top.map.needsUpdate = true;
  const gm = mesh(g, top, 0, 0, -80, 0); sc.add(gm);
  sc.add(mesh(new THREE.CylinderGeometry(258, 258, 20, 48), new THREE.MeshBasicMaterial({ color: '#1a0e08' }), 0, 420, -60).rotateX(Math.PI / 2));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(272, 16, 8, 64), toon('#c9783a')); ring.position.set(0, 420, 22); sc.add(ring);
  sc.add(mesh(new THREE.BoxGeometry(1400, 70, 40), toon('#6b3a1c', WOODTEX), 0, -40, 20, 4));
  GU.strings = []; for (let s = 0; s < 6; s++) { const pts = []; for (let i = 0; i <= 60; i++) pts.push(V(-1000 + i * (2000 / 60), 0, 0)); const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, s === 3 ? 7 : 4, 6); const m = mesh(geo, toon('#e9e5dc'), 0, -260 + s * 90, 60, 0); sc.add(m); GU.strings.push({ m, y: -260 + s * 90 }); }
}
function setString(st, a) {
  const pts = []; for (let i = 0; i <= 60; i++) { const u = i / 60; pts.push(V(-1000 + u * 2000, a * Math.sin(Math.PI * u), 0)); }
  st.m.geometry.dispose(); st.m.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 7, 6);
}

// ================= init / render =================
export function init3d() {
  GL = document.createElement('canvas'); GL.width = W; GL.height = H;
  renderer = new THREE.WebGLRenderer({ canvas: GL, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  makeTex(); buildValley(); buildParade(); buildBoots(); buildGeneral(); buildGuitar();
  composer = new EffectComposer(renderer); composer.setPixelRatio(1); composer.setSize(W, H);
  renderPass = new RenderPass(SC.valley, camera); composer.addPass(renderPass);
  bokeh = new BokehPass(SC.valley, camera, { focus: 1500, aperture: 0.0, maxblur: 0.008 }); composer.addPass(bokeh);
  composer.addPass(new OutputPass());
  window.SHOTS3D = SHOTS;
}
export function render3d(t) {
  resetSprites();
  const [id, t0] = sceneAt(t), [, t1] = sceneT(id);
  const shot = SHOTS[id](t, t - t0, clamp((t - t0) / (t1 - t0)));
  const sc = SC[shot.set || 'valley'];
  camera.fov = shot.fov || 38; camera.position.copy(shot.pos); camera.up.set(0, 1, 0); camera.lookAt(shot.tgt);
  if (shot.roll) camera.rotateZ(shot.roll);
  if (shot.shake) { camera.position.x += shot.shake[0]; camera.position.y += shot.shake[1]; }
  camera.updateProjectionMatrix();
  // sprites need the final camera position for billboarding
  if (shot.people) shot.people(sc);
  if (shot.xray) { camera.layers.set(1); sc.overrideMaterial = XRAY; sc.background = C('#123a7a'); sc.userData.sky.visible = false; }
  renderPass.scene = sc; bokeh.scene = sc;
  const dist = shot.focus ? camera.position.distanceTo(shot.focus) : 1000;
  bokeh.uniforms.focus.value = dist; bokeh.uniforms.aperture.value = (shot.aperture ?? 0) * 1e-5; bokeh.uniforms.maxblur.value = shot.maxblur ?? 0.009;
  bokeh.enabled = (shot.aperture ?? 0) > 0;
  composer.render();
  if (shot.xray) { camera.layers.set(0); sc.overrideMaterial = null; sc.background = null; sc.userData.sky.visible = true; }
  return { gl: GL, shot };
}
export function project(x, y, z) { const v = V(x, y, z).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H, v.z]; }

// ================= shots =================
function valleyLook(t, opt = {}) { const L = opt.L || lookAt(t); applyLook(SC.valley, L, opt); VAL.groundMat.color.set(L.ground); VAL.waterMat.color.set(L.water); VAL.crownMat.color.set(L.mid); VAL.roadMat.color.set(mixHex('#c9a875', L.ground, 0.25)); VAL.grassMat.color.set(L.groundD); BR.stone.color.set(L.stone); VAL.waterMat.map.offset.y = -t * 0.02; for (const [i, c] of VAL.clouds.entries()) { c.position.x += 0; c.userData.mat.color.set(L.cloud); c.position.x = ((rnd(i + 3) - 0.5) * 16000 + t * (40 + i * 6)); } return L; }
const look = (pos, tgt, o = {}) => ({ pos: V(...pos), tgt: V(...tgt), ...o });
const RANKZ = [-42, -14, 14, 42];
function redBlock3(sc, t, B, front, o = {}) {
  const ranks = 19, sp = o.sp || 56, ph = marchPh(t);
  for (let r = 0; r < ranks; r++) for (let k = 0; k < 4; k++) {
    if (r * 4 + k >= 74) continue;
    let x = front + r * sp, z = RANKZ[k], gy = 0, rot = 0;
    if (x > X0 && x < X1) { const d = dp(B, x); x = d.x; gy = d.y; rot = d.a; }
    if (o.slide) { const s = o.slide(r, k, x, gy); x = s[0]; gy = s[1]; rot = s[2]; }
    person(sc, { ...RED, f: -1, gait: o.gait || 'march', ph, mood: o.mood || 'smug', rot, chin: o.chin || 0, arms: o.arms, sweat: o.sweat, sweatT: Math.round(t * 1.3 * 10) / 10 }, x, gy, z, 0.42, { res: o.res || 0.6 });
  }
  if (o.captain !== false) {
    let x = front - 90, gy = 0, rot = 0; if (x > X0 && x < X1) { const d = dp(B, x); x = d.x; gy = d.y; rot = d.a; }
    if (o.slide) { const s = o.slide(-1.6, 0, x, gy); x = s[0]; gy = s[1]; rot = s[2]; }
    person(sc, { ...RIVAL, f: -1, gait: o.gait || 'march', ph, mood: o.capMood || 'smug', arms: o.capArms || 'swing', sweat: o.sweat, sweatT: Math.round(t * 10) / 10, rot }, x, gy, 30, 0.48, { res: o.capRes || 0.9 });
  }
}
const deckFlat = { amp: 0, osc: 0, tilt: 0, snapped: 0 };
function blueOnDeck(sc, t, lt, list, B = deckFlat) {
  for (const s of list) { const x = clamp(s.x, X0 - 600, X1); const on = x > X0; const d = on ? dp(B, x) : { x, y: 0, a: 0 }; person(sc, { ...BLUE, ...s.p, rot: s.p.rot || 0 }, d.x, d.y, s.z ?? 0, s.s || 0.42, { res: s.res || 0.7 }); }
}

const SHOTS = {
  open(t, lt, u) {
    valleyLook(t, { L: LOOKS.morning }); hideProps(); updateBridge(deckFlat, t);
    const sh = look([lerp(-1500, -1350, easeIO(u)), lerp(260, 220, u), lerp(1900, 1700, easeIO(u))], [lerp(-820, -740, u), 160, 0], { fov: 36, focus: V(-1060, 200, 700), aperture: 2.2 });
    sh.people = sc => {
      const list = []; for (let i = 0; i < 10; i++) list.push({ x: -1000 + i * 70 + lt * 55 + noise(i * 3 + lt) * 30, z: RANKZ[i % 4] * 0.8, p: { gait: 'stumble', ph: lt * 9 + i * 2, seed: i * 7, mood: i % 3 ? 'dizzy' : 'scared', f: i === 4 ? -1 : 1 } });
      blueOnDeck(sc, t, lt, list);
      person(sc, { ...HERO, f: -1, mood: lt < 1.5 ? 'stern' : 'smug', arms: lt < 1.2 ? 'back' : 'point', gait: 'stand', chin: 0.05 }, -1060, 0, 700, 0.95, { res: 2.0 });
    };
    return sh;
  },
  parade(t, lt, u) {
    applyLook(SC.parade, LOOKS.morning, { sunDir: [0.5, 0.7, 0.6] }); waveFlag(PA.flag, PA.flagBase, t);
    const k = easeIO(inv(0, 0.75, u));
    const sh = look([lerp(150, -200, u), lerp(1200, 330, k), lerp(900, 1500, k)], [lerp(0, -50, u), lerp(900, 170, k), lerp(-900, -100, k)], { set: 'parade', fov: 40, focus: V(0, 150, 300), aperture: 0.8 * k });
    sh.people = sc => {
      const ph = marchPh(t);
      for (let r = 0; r < 6; r++) for (let c = -4; c <= 4; c++) person(sc, { ...BLUE, f: 1, gait: 'march', ph, mood: 'stern' }, c * 150 + (r % 2) * 20, 0, -380 + r * 150, 0.5, { res: 0.6 });
      person(sc, { ...HERO, f: -1, mood: 'proud', arms: 'back', chin: 0.08 }, 380, 0, 760, 0.85, { res: 1.6 });
    };
    return sh;
  },
  boots(t, lt) {
    applyLook(SC.boots, LOOKS.morning, { sunDir: [0.6, 0.8, 0.7] });
    const [l0, r0, l1] = EV.left, all = EV.allboots;
    const lift = (tt, t0) => { const k = tt - t0; if (k < -0.32) return 260; if (k < 0) return 260 * (1 - easeIn((k + 0.32) / 0.32)); return Math.max(0, kick(tt, t0, 30, 14)) * 18; };
    BO.mesh.forEach(m => m.visible = false); let dustAt = [];
    let sh;
    const single = t < r0 - 0.05 || (t >= l1 - 0.05 && t < l1 + 0.3);
    if (single || t < l1 - 0.05) {
      const isR = !single, tt = isR ? r0 : (t < r0 - 0.05 ? l0 : l1), m = BO.mesh[0];
      m.visible = true; m.position.set(0, lift(t, tt), 0); m.scale.set(isR ? -1 : 1, 1, 1); m.rotation.set(0, 0, 0);
      const s = shake(t, tt, 14, 0.35);
      sh = look([isR ? -260 : 260, 110 + s[1], 620 + s[0]], [0, 170, 0], { set: 'boots', fov: 40, roll: isR ? -0.05 : 0.05, focus: V(0, 150, 0), aperture: 3.5 });
      dustAt = [[tt, 60 * (isR ? -1 : 1), 0, 1.2]];
    } else {
      const beats = [all - BEAT * 2, all - BEAT, all]; let tb = beats[0]; for (const b of beats) if (t > b - 0.3) tb = b;
      for (let i = 0; i < 13; i++) { const m = BO.mesh[i]; m.visible = true; m.position.set(-1200 + i * 200, lift(t, tb), -60 + (i % 2) * 40); m.scale.set(1, 1, 1); }
      const lt2 = t - l1 - 0.3, s = shake(t, all, 20, 0.5);
      sh = look([lerp(-500, 500, sstep(0, 2.2, lt2)), 230 + s[1], 2100], [lerp(-300, 300, sstep(0, 2.2, lt2)), 140, 0], { set: 'boots', fov: 38, roll: 0.02, focus: V(0, 150, 0), aperture: 1.8 });
      dustAt = beats.map(b => [b, 0, 0, 3]);
    }
    let di = 0; const d = new THREE.Object3D();
    for (const [t0, x, z, s] of dustAt) { const k = t - t0; if (k < 0 || k > 0.9) continue; const e = easeOut(k / 0.9); for (let i = 0; i < 24; i++) { const a = rnd(i + t0) * Math.PI * 2; d.position.set(x + Math.cos(a) * 160 * s * e, 20 + 30 * e * rnd(i + 3), z + Math.sin(a) * 120 * s * e); d.scale.setScalar((18 + 30 * e) * s * (1 - e * 0.7)); d.updateMatrix(); BO.dust.setMatrixAt(di++, d.matrix); } }
    BO.dust.count = di; BO.dust.instanceMatrix.needsUpdate = true;
    return sh;
  },
  general(t, lt, u) {
    applyLook(SC.general, LOOKS.golden, { sunDir: [-0.4, 0.35, -1] }); waveFlag(GE.flag, GE.flagBase, t, 26);
    const sh = look([lerp(80, 30, u), 420, lerp(1150, 980, easeIO(u))], [0, 520, 0], { set: 'general', fov: 36, roll: lerp(0.04, 0, u), focus: V(0, 500, 0), aperture: 4 });
    sh.people = sc => person(sc, { coat: '#2f8f5a', hat: 'general', plume: '#d43c3c', stache: 'walrus', medals: true, epaulettes: true, glint: Math.round(t * 7 * 10) / 10, f: 1, mood: 'proud', chin: 0.12 + Math.sin(lt * 3) * 0.02, arms: 'back' }, 0, 0, 0, 2.1, { res: 1.6 });
    return sh;
  },
  break(t, lt, u) {
    valleyLook(t, { L: LOOKS.morning }); hideProps(); updateBridge(deckFlat, t);
    const tb = EV.breakstep, d = sceneT('break')[1], punch = easeIn(inv(tb, tb + 0.12, t)) * 0.3 + easeIn(inv(d - 0.2, d, t)) * 2.4, s = shake(t, tb, 12, 0.5);
    const head = V(-1100, 520, 300);
    const base = V(-1100 + lt * 10, 380, 300 + 1150), p = base.clone().lerp(head.clone().add(V(0, -10, 40)), clamp(punch * 0.42, 0, 0.96));
    const sh = look([p.x + s[0], p.y + s[1], p.z], [head.x, lerp(400, 500, clamp(punch, 0, 1)), head.z], { fov: 36, focus: head, aperture: 3.5 });
    sh.people = sc => person(sc, { ...HERO, f: 1, mood: t > tb - 0.25 ? 'yell' : 'stern', mouth: Math.sin(t * 30) * 0.5 + 0.5, arms: t > tb - 0.2 ? 'up' : 'back', chin: t > tb ? 0.12 : 0 }, -1100, 0, 300, 1.75, { res: 2.4 });
    return sh;
  },
  bridge(t, lt, u) {
    valleyLook(t, { L: LOOKS.morning }); hideProps(['bunting']); updateBridge(deckFlat, t);
    const sh = look([lerp(-900, -300, easeIO(u)), lerp(1500, 500, easeOut(u)), lerp(3600, 3100, u)], [0, lerp(80, 180, u), 0], { fov: 38 });
    sh.people = sc => { for (let i = 0; i < 12; i++) person(sc, { ...BLUE, f: 1, mood: 'neutral', gait: 'stand' }, -1500 + i * 55, 0, RANKZ[i % 4], 0.42, { res: 0.5 }); person(sc, { ...HERO, f: 1, mood: 'smug' }, -1000, 0, 60, 0.5, { res: 0.6 }); };
    sh.iris = easeOut(inv(0, 0.35, lt)); sh.glint = true;
    return sh;
  },
  ducks(t, lt, u) {
    valleyLook(t, { L: LOOKS.morning }); hideProps(); updateBridge(deckFlat, t);
    const sh = look([lerp(-650, -300, easeIO(u)), 90, 1550], [lerp(-420, -150, easeIO(u)), 0, 0], { fov: 38, focus: V(-300, 0, 0), aperture: 1.2 });
    sh.people = sc => {
      const list = []; for (let i = 0; i < 11; i++) list.push({ x: -690 + i * 66 + lt * 60 + noise(i * 5 + lt * 0.8) * 50 + (i === 6 ? -lt * 90 : 0), z: RANKZ[i % 4] * 0.9, p: { gait: 'stumble', ph: lt * 10 + i * 1.7, seed: i * 5, mood: ['dizzy', 'scared', 'shock'][i % 3], arms: i % 2 ? 'flail' : 'swing', f: i === 6 ? -1 : 1, rot: i === 3 ? Math.sin(lt * 4) * 0.3 : 0 } });
      blueOnDeck(sc, t, lt, list);
    };
    hideProps(['duck']); const q = pulse(t, EV.quack[1], 0.03, 0.3);
    PR.duck.position.set(-330 + lt * 15, -232 + Math.sin(t * 2) * 3, 520); PR.duck.rotation.set(0, Math.PI * 0.85, Math.sin(t * 3) * 0.05); PR.duckBeak.scale.set(1 + q * 0.6, 1 + q * 0.3, 1 + q * 0.6);
    sh.quack = [PR.duck.position.x, PR.duck.position.y + 150, PR.duck.position.z, q];
    return sh;
  },
  rival(t, lt, u) {
    valleyLook(t, { L: LOOKS.morning }); hideProps(); updateBridge(deckFlat, t);
    const q = EV.quote, wp = easeIO(inv(EV.whip, EV.whip + 0.28, t)), qq = easeBack(inv(q, q + 0.18, t));
    const p0 = V(-300, 40, 1300), p1 = V(1500, 170, 1500), p2 = V(1430, 240, 920);
    const pos = p0.clone().lerp(p1, wp).lerp(p2, qq * 0.9).add(V(0, 0, -inv(q, sceneT('rival')[1], t) * 60));
    const tgt = V(lerp(-200, 1400, wp), lerp(30, 180, wp), lerp(0, 330, wp)).lerp(V(1390, 230, 330), qq);
    const sh = look([pos.x, pos.y, pos.z], [tgt.x, tgt.y, tgt.z], { fov: 38, roll: -0.02 * qq, focus: V(1390, 200, 330), aperture: 1.2 + qq * 2.5 });
    sh.people = sc => {
      const list = []; for (let i = 0; i < 8; i++) list.push({ x: -150 + i * 70 + noise(i * 5 + t) * 40, z: RANKZ[i % 4], p: { gait: 'stumble', ph: t * 10 + i * 1.7, seed: i * 5, mood: 'dizzy' } }); blueOnDeck(sc, t, lt, list);
      const lg = t > EV.whip + 0.5;
      for (let k = 0; k < 4; k++) for (let r = 0; r < 9; r++) person(sc, { ...RED, f: -1, mood: lg ? 'laugh' : 'smug', gait: 'stand', lean: lg ? Math.round(Math.sin(t * 22 + r) * 0.05 * 100) / 100 : 0 }, 1520 + r * 62, 0, 180 + k * 55, 0.42, { res: 0.6 });
      const laugh = t > EV.whip + 0.3 && t < q - 0.1;
      person(sc, { ...RIVAL, f: -1, mood: laugh ? 'laugh' : 'smug', arms: laugh ? 'hips' : 'point', cane: !laugh, lean: laugh ? Math.round((Math.sin(t * 24) * 0.06 - 0.08) * 100) / 100 : 0 }, 1390, 0, 330, 0.6, { res: 2.0 });
    };
    return sh;
  },
  weird(t, lt, u) {
    valleyLook(t, { L: mixLook(LOOKS.morning, LOOKS.storm, 0.3) }); hideProps(); updateBridge(deckFlat, t);
    const sh = look([-1300 + lt * 40, 280, 1250], [-1050, 300, 300], { fov: 34, roll: -0.16, focus: V(-1050, 300, 300), aperture: 4 });
    sh.people = sc => person(sc, { ...HERO, f: 1, mood: 'smug', arms: 'back', chin: 0.04 }, -1050, 0, 300, 1.0, { res: 2.0 });
    return sh;
  },
  tiptoe(t, lt, u) {
    valleyLook(t, { L: LOOKS.morning }); hideProps(); updateBridge(deckFlat, t);
    const sp = 230, head = -560 + lt * 75, cx = head - 260;
    const sh = look([head - 40, 330, lerp(2200, 2400, u)], [head - 200, 60, 0], { fov: 30, focus: V(head - 200, 60, 0), aperture: 0.8 }); sh.marks = [];
    sh.people = sc => {
      for (let i = 0; i < 7; i++) { const x = head - i * sp; if (x < -1400) continue; const on = x > X0; const d = on ? dp(deckFlat, x) : { x, y: 0 };
        person(sc, { ...BLUE, f: 1, gait: x > X0 - 40 ? 'tiptoe' : 'stand', ph: lt * 7 + i, mood: 'scared', arms: 'chest', sweat: i === 0, sweatT: Math.round(t * 10) / 10 }, d.x, d.y, 0, 0.44, { res: 0.9 });
        if (i > 0 && x > X0 - 200 && u > 0.35) sh.marks.push([d.x + 40, d.x + sp - 40, d.y + 200, clamp((u - 0.35) * 4)]); }
    };
    return sh;
  },
  march(t, lt, u) {
    const L = valleyLook(t, { sunDir: [-0.7, 0.3, -0.6] }); hideProps(); const B = bridgeAt(t); updateBridge(B, t);
    const p15 = TL.phrases[15].start, p14 = TL.phrases[14].start, t0 = sceneT('march')[0];
    if (t < p15 - 0.05) {
      const chest = sstep(p14, p14 + 0.25, t), k = easeIO(inv(t0, p15, t));
      const sh = look([lerp(1050, 1700, k), 150, 750], [lerp(1150, 1800, k), 150, 150], { fov: 34, focus: V(lerp(1150, 1800, k), 150, 180), aperture: 3 });
      sh.people = sc => {
        for (let kk = 0; kk < 4; kk++) for (let r = 0; r < 16; r++) person(sc, { ...RED, f: -1, mood: chest > 0.5 ? 'proud' : 'smug', chin: Math.round(chest * 0.14 * 100) / 100, gait: 'stand', arms: 'stiff' }, 1100 + r * 62, 0, 180 - kk * 55, 0.42, { res: 1.0 });
        person(sc, { ...RIVAL, f: 1, mood: 'smug', arms: 'hips', chin: 0.1 }, 1010, 0, 240, 0.5, { res: 1.2 });
      };
      return sh;
    }
    const lt2 = t - p15;
    const sh = look([lerp(1500, 900, easeIO(lt2 / 2.2)), lerp(380, 300, lt2 / 2.2), 1900], [lerp(700, 300, easeIO(lt2 / 2.2)), 60, 0], { fov: 38 });
    sh.people = sc => redBlock3(sc, t, B, 760 - lt2 * 110, {});
    return sh;
  },
  thump(t, lt, u) {
    valleyLook(t, { sunDir: [-0.7, 0.3, -0.6] }); hideProps(); const B = bridgeAt(t); updateBridge(B, t);
    let s = [0, 0]; for (const th of EV.thumps) { const k = shake(t, th, 10, 0.4); s[0] += k[0]; s[1] += k[1]; }
    const sh = look([700 - lt * 30, 40, 330], [420 - lt * 30, 60, 0], { fov: 40, roll: 0.05, shake: s, focus: V(480, 40, 40), aperture: 3 });
    sh.people = sc => redBlock3(sc, t, B, 380 - lt * 40, { res: 1.0, capRes: 1.2 });
    return sh;
  },
  hum(t, lt, u) {
    valleyLook(t, { sunDir: [-0.7, 0.3, -0.6] }); hideProps(); const B = bridgeAt(t); updateBridge(B, t);
    if (t < EV.wobble[0] - 0.1) {
      const v = Math.sin(t * 90) * 1.5 * sstep(EV.hum, EV.hum + 0.6, t); BR.plate.position.x += v; BR.plate.position.y += v * 0.5;
      const pp = BR.plate.position;
      const sh = look([pp.x + 60 - lt * 8, pp.y + 25, pp.z + 150 - lt * 10], [pp.x, pp.y + 6, pp.z], { fov: 40, roll: 0.08, focus: pp.clone(), aperture: 25, maxblur: 0.012 });
      sh.rings = [pp.x, pp.y, pp.z];
      return sh;
    }
    const sh = look([150, 520, 2900], [40, 40, 0], { fov: 38 });
    sh.people = sc => redBlock3(sc, t, B, 300 - lt * 30, { sweat: t > EV.wobble[1] });
    PR.ripples.forEach((r, i) => { const k = (t * 1.6 + i / 4) % 1; r.visible = true; r.position.set(0, -226, 80); r.scale.set(200 + k * 800, 120 + k * 400, 1); r.material.opacity = 0.8 * (1 - k); });
    return sh;
  },
  xray(t, lt, u) {
    valleyLook(t); hideProps(); const B = bridgeAt(t); updateBridge(B, t);
    const sh = look([lerp(-300, 300, u), 380, 2700], [0, 0, 0], { fov: 38, xray: true });
    return sh;
  },
  what(t, lt, u) {
    valleyLook(t, { sunDir: [-0.7, 0.3, -0.6] }); hideProps(); const B = bridgeAt(t); updateBridge(B, t);
    const s = shake(t, EV.what, 6, 0.3), p = dp(B, -280);
    const sh = look([-520 + s[0], p.y + 240 + s[1], 40], [-280, p.y + 190, 25], { fov: 36, roll: 0.12, focus: V(-280, p.y + 200, 30), aperture: 6 });
    sh.people = sc => redBlock3(sc, t, B, -190, { capMood: 'shock', capArms: 'up', mood: 'scared', sweat: true, res: 1.2, capRes: 2.0 });
    return sh;
  },
  string(t, lt, u) {
    const mc = EV.pluck - 0.55, ts = sceneT('string')[0];
    if (t < mc) {
      valleyLook(t, { sunDir: [-0.7, 0.3, -0.6] }); hideProps(); const B = { amp: 36, osc: Math.sin((t - ts) * 7), tilt: 0 }; updateBridge(B, t);
      const k = easeIO(inv(ts, mc, t));
      return look([0, lerp(300, 20, k), lerp(2900, 2000, k)], [0, 0, 0], { fov: 38, envelope: true });
    }
    const tp = EV.pluck, a = t < tp ? -38 * sstep(mc, tp - 0.05, t) : 60 * Math.exp(-(t - tp) * 1.6) * Math.cos((t - tp) * 48);
    setString(GU.strings[3], a);
    const sh = look([lerp(260, 120, t - mc), -120, 2300 - (t - mc) * 80], [0, 0, 0], { set: 'guitar', fov: 38, focus: V(0, 0, 60), aperture: 1.5 });
    sh.pluck = { tp, mc };
    return sh;
  },
  swing(t, lt, u) {
    valleyLook(t, { L: LOOKS.morning }); hideProps(['tree']); updateBridge(deckFlat, t);
    const P = EV.pushes; let amp = 0.18; P.forEach((p, i) => amp += sstep(p, p + 0.3, t) * [0.18, 0.22, 0.35, 0.6][i]);
    const loop = sstep(P[3] + 0.1, P[3] + 0.6, t);
    const ang = loop > 0 ? lerp(Math.sin((t - P[0]) * 4.2) * Math.min(amp, 1.3), Math.PI * 2 * easeIO(inv(P[3] + 0.1, P[3] + 0.9, t)) + 0.9, loop) : Math.sin((t - sceneT('swing')[0]) * 4.2 + 1) * Math.min(amp, 1.3);
    const piv = V(-120, 1230, 0), len = 820, seat = V(piv.x + Math.sin(ang) * len, piv.y - Math.cos(ang) * len, 0);
    PR.ropes.forEach((r, i) => { const z = i ? 40 : -40; const a = V(piv.x, piv.y, z), b = V(seat.x, seat.y, z); const d = b.clone().sub(a); r.position.copy(a).add(b).multiplyScalar(0.5); r.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize()); r.scale.set(1, d.length(), 1); });
    PR.seat.position.copy(seat); PR.seat.rotation.set(0, 0, ang);
    const T = PR.tree.position, sp = seat.clone().add(T);
    const sh = look([T.x - 150, T.y + 700 + loop * 150, T.z + 2100 + loop * 300], [T.x - 150, T.y + 640 + loop * 100, T.z], { fov: 40, focus: sp, aperture: 1.2 });
    let push = 0; P.forEach(p => push = Math.max(push, pulse(t, p, 0.08, 0.25)));
    sh.people = sc => {
      const m = person(sc, { coat: '#ff7a8a', hat: 'cap', f: 1, mood: loop > 0.3 ? 'shock' : 'happy', arms: 'up', rot: 0 }, sp.x, sp.y + 10, T.z + 5, 0.75, { res: 1.4, noShadow: true });
      m.rotateZ(ang); // rides the seat
      person(sc, { ...HERO, f: 1, mood: 'happy', arms: push > 0.3 ? 'push' : 'swing', gait: 'stand' }, T.x - 420 + push * 40, 0, T.z + 40, 0.95, { res: 1.4 });
    };
    sh.push = P.map(p => [p, T.x - 300, 700, T.z]);
    return sh;
  },
  pushes(t, lt, u) {
    valleyLook(t, { sunDir: [-0.7, 0.3, -0.6] }); hideProps(); const B = bridgeAt(t); updateBridge(B, t);
    const sh = look([lerp(-300, 0, u), lerp(250, 650, u), lerp(1300, 2700, easeIO(u))], [lerp(-200, 0, u), 0, 0], { fov: 38, roll: Math.sin(t * 3) * 0.015 });
    const front = -520 + lt * 20; sh.people = sc => redBlock3(sc, t, B, front, { sweat: true, mood: 'scared' });
    sh.arrows = { B, front };
    return sh;
  },
  snap(t, lt, u) {
    valleyLook(t, { sunDir: [-0.7, 0.3, -0.6] }); hideProps(); const B = bridgeAt(t); updateBridge(B, t);
    if (t < EV.tilt - 0.32) {
      const k = t - EV.snap, pp = BR.plate.position.clone(), s = shake(t, EV.snap, 6, 0.4);
      if (k > 0) { const b = BR.bolts[1]; b.visible = false; BR.flyBolt.visible = true; BR.flyBolt.position.set(pp.x + 11 + k * 900, pp.y + k * 500 - k * k * 900, pp.z + 20 + k * 300); BR.flyBolt.rotation.set(k * 20, k * 14, k * 9);
        if (k < 0.35) { BR.sparks.count = 24; for (let i = 0; i < 24; i++) { const a = rnd(i) * Math.PI * 2, e = rnd(i + 9) * Math.PI - Math.PI / 2, r = k * (300 + rnd(i + 4) * 300); setI(BR.sparks, i, pp.x + 11 + Math.cos(a) * Math.cos(e) * r, pp.y + Math.sin(e) * r, pp.z + 10 + Math.sin(a) * Math.cos(e) * r, 0, 2, 2, 1, a, e); } BR.sparks.instanceMatrix.needsUpdate = true; } }
      else BR.bolts[1].visible = true;
      return look([pp.x + 110 + s[0], pp.y + 45 + s[1], pp.z + 250], [pp.x, pp.y, pp.z], { fov: 40, roll: -0.1, focus: pp, aperture: 22, maxblur: 0.012, flash: k > -0.02 && k < 0.08 });
    }
    BR.bolts[1].visible = true;
    const s = shake(t, EV.tilt, 18, 0.6);
    const sh = look([500 + s[0], 250 + s[1], 2300], [150, -40, 0], { fov: 38, roll: -0.12 * sstep(EV.tilt - 0.3, EV.tilt + 0.3, t) });
    sh.people = sc => redBlock3(sc, t, B, -480, { mood: 'shock', capMood: 'shock', capArms: 'up', arms: 'up' });
    return sh;
  },
  river(t, lt, u) {
    valleyLook(t, { sunDir: [-0.7, 0.3, -0.6] }); hideProps(); const B = { amp: 0, osc: 0, tilt: 0.27, snapped: 1 }; updateBridge(B, t);
    const st = EV.still;
    if (t < st - 0.05) {
      const slideStart = TL.words.find(w => w.p === 26 && w.w === 'slide').s - 0.6;
      const sh = look([lerp(500, 800, easeIO(u * 1.4)), lerp(150, 60, u), lerp(2100, 1800, u)], [lerp(250, 450, u), -120, 0], { fov: 38, roll: -0.06 });
      sh.people = sc => redBlock3(sc, t, B, -480, { mood: 'shock', capMood: 'shock', capArms: 'up', slide: (r, k, gx, gy) => {
        const d0 = -480 + r * 56; const s = Math.max(0, t - slideStart - (18 - r) * 0.04);
        const along = d0 + s * s * 420; const d = dp(B, Math.min(along, X1)); const over = Math.max(0, along - X1);
        return [d.x + over * 0.6, d.y - over * over * 0.004 - over * 0.3, -0.27]; } });
      // splashes
      let n = 0; const o = new THREE.Object3D();
      for (let j = 0; j < 6; j++) { const t0 = slideStart + 0.75 + j * 0.22, k = t - t0; if (k < 0 || k > 1.2) continue; for (let i = 0; i < 18; i++) { const a = rnd(i * 3 + j) * Math.PI * 2, v = 200 + rnd(i + j * 7) * 350; o.position.set(560 + j * 50 + Math.cos(a) * 120 * k, -230 + v * k - 500 * k * k, Math.sin(a) * 140 * k + RANKZ[i % 4]); if (o.position.y < -232) continue; o.scale.setScalar(10 * (1 - k / 1.2) + 2); o.updateMatrix(); PR.splashes.setMatrixAt(n++, o.matrix); } }
      PR.splashes.count = n; PR.splashes.instanceMatrix.needsUpdate = true;
      return sh;
    }
    hideProps(['shako']); PR.shako.position.set(260 + (t - st) * 30, -222, 150); PR.shako.rotation.set(0.5, t, 0.3);
    const sh = look([0, -130, 900], [0, -170, 0], { fov: 38, focus: V(0, -170, 60), aperture: 3 });
    sh.people = sc => { const ph = marchPh(t);
      for (let i = 0; i < 9; i++) person(sc, { ...RED, f: -1, mood: 'stern', legs: false, arms: 'swing', gait: 'march', ph }, -420 + i * 105, -230 - 150 * 0.62 + Math.sin(ph + (i % 2) * Math.PI) * 8, RANKZ[i % 4] + 40, 0.62, { res: 1.2, noShadow: true });
      person(sc, { ...RIVAL, f: -1, mood: 'stern', stache: 'droop', legs: false, arms: 'swing' }, 40, -230 - 150 * 0.7 + Math.sin(ph) * 8, 160, 0.7, { res: 1.4, noShadow: true }); };
    return sh;
  },
  rules(t, lt, u) {
    valleyLook(t, { L: LOOKS.golden, sunDir: [-0.7, 0.3, -0.6] }); hideProps(['board']); updateBridge(deckFlat, t);
    const ts = EV.stamp, sk = easeOut(inv(ts - 0.12, ts, t)); drawPaper(t > ts - 0.12 ? sk : 0);
    const s = shake(t, ts, 8, 0.4), bp = PR.board.position;
    const sh = look([bp.x + lerp(-250, -40, easeIO(u)) + s[0], lerp(330, 400, u) + s[1], bp.z + lerp(1300, 700, easeIO(u))], [bp.x, 380, bp.z], { fov: 38, focus: V(bp.x, 400, bp.z), aperture: 3 });
    sh.people = sc => { blueOnDeck(sc, t, lt, [0, 1, 2, 3, 4, 5].map(i => ({ x: -500 + i * 200 + lt * 50, z: RANKZ[i % 4], p: { gait: 'stumble', ph: lt * 8 + i, seed: i, mood: 'happy' } })));
      person(sc, { ...HERO, f: -1, mood: 'smug', gait: 'walk', ph: lt * 6, arms: 'back' }, bp.x + 350 - lt * 40, 0, bp.z + 160, 0.8, { res: 1.4 }); };
    return sh;
  },
  fire(t, lt, u) {
    valleyLook(t, { L: LOOKS.night, night: true, sunDir: [0.4, 0.5, -1] }); hideProps(['fire', 'line']); updateBridge(deckFlat, t);
    const fl = 0.85 + noise(t * 9) * 0.15; PR.fireLight.intensity = 9 * fl;
    PR.flames.forEach((f, i) => { f.scale.set(1, (0.85 + noise(t * 8 + i * 3) * 0.2), 1); f.rotation.z = noise(t * 6 + i) * 0.1; });
    PR.drips.forEach((d, i) => { const k = (t * 1.3 + i * 0.27) % 1; d.position.set(80 + i * 26, 200 - k * 200, 0); });
    PR.bootMeshes.forEach((b, i) => b.position.set(-80 + i * 140 - 60, 280 - i * 60, -40));
    const F = PR.fire.position;
    const sh = look([F.x + lerp(-320, -150, u), 300, F.z + lerp(1300, 950, easeIO(u))], [F.x + 60, 260, F.z], { fov: 38, focus: V(F.x + 180, 250, F.z + 80), aperture: 2.5 });
    sh.people = sc => person(sc, { coat: '#f1e6cf', bare: true, hat: 'wet', stache: 'droop', f: -1, mood: 'angry', steam: true, steamT: Math.round(t * 30) / 30, arms: 'hips', gait: 'stand', lean: Math.round(Math.sin(t * 30) * 0.01 * 100) / 100 }, F.x + 230, 0, F.z + 80, 0.95, { res: 1.6, tint: C('#ffd2b0') });
    return sh;
  },
};
