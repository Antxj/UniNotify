// Dev-only: rasterises src/icons/icon.svg to PNGs for the store and README.
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { render } from "./render.mjs";

const svg = readFileSync("src/icons/icon.svg", "utf8");
mkdirSync("store/icons", { recursive: true });
mkdirSync(".tmp", { recursive: true });
for (const size of [16, 32, 48, 64, 96, 128, 256, 512]) {
  const html = `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`;
  writeFileSync(".tmp/icon.html", html);
  render(".tmp/icon.html", `store/icons/icon-${size}.png`, size, size);
  console.log("icon", size);
}
rmSync(".tmp", { recursive: true, force: true });
