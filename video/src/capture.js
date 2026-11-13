// Usage: node capture.js stills t1 t2 ...     -> build/stills/t_<t>.png
//        node capture.js range <f0> <f1> <out.mp4>  -> encodes frames f0..f1-1 at 60 fps
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const FPS = 60, URL = process.env.PAGE || 'http://127.0.0.1:8765/src/index3d.html';
(async () => {
  const [mode, ...args] = process.argv.slice(2);
  const browser = await chromium.launch(process.env.GPU ? { headless: true, args: ['--force-color-profile=srgb', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=default'] } : { args: ['--disable-gpu-vsync', '--force-color-profile=srgb', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.error('PAGE:', m.text()); });
  page.on('pageerror', e => console.error('PAGEERR:', e.message));
  await page.addInitScript(() => { window.CAPTURE = true; });
  await page.goto(URL); await page.waitForFunction(() => window.READY === true);
  const grab = async (t, type) => {
    const d = await page.evaluate(([t, type]) => { renderAt(t); return document.getElementById('c').toDataURL(type, 0.95); }, [t, type]);
    return Buffer.from(d.split(',')[1], 'base64');
  };
  if (mode === 'stills') {
    const SD = process.env.SD || '../build/stills'; fs.mkdirSync(SD, { recursive: true });
    for (const t of args) fs.writeFileSync(`${SD}/t_${(+t).toFixed(2)}.png`, await grab(+t, 'image/png'));
  } else {
    const [f0, f1, out] = [+args[0], +args[1], args[2]];
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = f0; f < f1; f++) {
      const buf = await grab(f / FPS, 'image/jpeg');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - f0) % 300 === 0) console.log(out, f);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})();
