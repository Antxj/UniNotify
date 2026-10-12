// Dev-only helper: renders an HTML file to a PNG with headless Edge/Chrome.
// Usage: node tools/render.mjs <input.html> <output.png> <width> <height>
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const BROWSERS = [
  process.env.CHROME_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
].filter(Boolean);

export function render(input, output, width, height) {
  const bin = BROWSERS.find((b) => existsSync(b));
  if (!bin) throw new Error("No Chromium-based browser found; set CHROME_PATH");
  execFileSync(bin, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--default-background-color=00000000",
    `--window-size=${width},${height}`,
    `--screenshot=${resolve(output)}`,
    pathToFileURL(resolve(input)).href
  ], { stdio: "ignore" });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output, w, h] = process.argv.slice(2);
  render(input, output, Number(w), Number(h));
}
