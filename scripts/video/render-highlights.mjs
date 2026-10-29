// Renders a transparent 1920x1080 PNG per frame with yellow highlight boxes (build/dyn/highlights.json).
import { chromium } from "playwright-core";
import fs from "fs";

const boxes = JSON.parse(fs.readFileSync("build/dyn/highlights.json", "utf8"));
const b = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
for (const [i, list] of Object.entries(boxes)) {
  const divs = list
    .map(
      ([x, y, w, h]) =>
        `<div style="position:absolute;left:${x - 8}px;top:${y - 8}px;width:${w + 16}px;height:${h + 16}px;` +
        `border:5px solid #FFCA2A;border-radius:12px;box-sizing:border-box;` +
        `box-shadow:0 0 0 3px rgba(22,22,22,.55),0 0 24px rgba(255,202,42,.55)"></div>`,
    )
    .join("");
  await p.setContent(
    `<html><body style="margin:0;background:transparent;width:1920px;height:1080px">${divs}</body></html>`,
  );
  await p.screenshot({
    path: `build/dyn/hl${String(i).padStart(2, "0")}.png`,
    omitBackground: true,
  });
}
await b.close();
console.log("highlights", Object.keys(boxes).length);
