// Renders the caption bar and "synthetic demo data" badge per frame as transparent 1920x1080 PNGs
// (build/captions.json, written by build_dynamic.py). Overlaid by ffmpeg, which here has no drawtext.
import { chromium } from "playwright-core";
import fs from "fs";
const caps = JSON.parse(fs.readFileSync("build/captions.json", "utf8"));
fs.mkdirSync("build/cap", { recursive: true });
const b = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
for (let i = 0; i < caps.length; i++) {
  if (!caps[i]) continue;
  await p.setContent(
    `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700&display=swap">
<style>html,body{margin:0;background:transparent;width:1920px;height:1080px;font-family:Archivo,Arial,sans-serif}
.bar{position:absolute;left:0;right:0;bottom:0;height:92px;background:rgba(22,22,22,.82);display:flex;align-items:center;padding:0 48px;color:#fff;font-size:34px;font-weight:600}
.bar:before{content:"";display:inline-block;width:10px;height:44px;background:#FFCA2A;margin-right:22px}
.badge{position:absolute;right:36px;top:28px;background:#FFCA2A;color:#161616;font-size:22px;font-weight:700;letter-spacing:2px;padding:10px 16px}</style></head>
<body><div class="badge">SYNTHETIC DEMO DATA</div><div class="bar">${esc(caps[i])}</div></body></html>`,
    { waitUntil: "networkidle" },
  );
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `build/cap/${String(i).padStart(2, "0")}.png`, omitBackground: true });
}
await b.close();
console.log("captions done");
