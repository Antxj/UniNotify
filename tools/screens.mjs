// Dev-only: renders the real popup / options UI with fictional demo data and
// composes 1280x800 store screenshots (also used in the README).
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { render } from "./render.mjs";

const read = (p) => readFileSync(p, "utf8");
const iconData = "data:image/svg+xml;base64," + Buffer.from(read("src/icons/icon.svg")).toString("base64");
const messages = JSON.parse(read("src/_locales/en/messages.json"));
const min = 60e3;
const now = Date.now();

const DEMO_STATE = {
  lastCheck: now - 40e3,
  checking: false,
  providers: { gmail: { enabled: true, granted: true }, outlook: { enabled: true, granted: true }, proton: { enabled: true, granted: true } },
  accounts: [
    { id: "gmail:alex.rivera@gmail.com", provider: "gmail", email: "alex.rivera@gmail.com", unread: 4, inboxUrl: "", messages: [
      { id: "1", from: "Maya Chen", subject: "Trip photos are up!", time: now - 3 * min },
      { id: "2", from: "Bookshop Weekly", subject: "Your October reading list", time: now - 52 * min },
      { id: "3", from: "Sam Okafor", subject: "Re: Saturday football?", time: now - 3 * 60 * min }
    ] },
    { id: "gmail:alex@studio-rivera.com", provider: "gmail", email: "alex@studio-rivera.com", unread: 2, inboxUrl: "", messages: [
      { id: "4", from: "Priya N.", subject: "Invoice #1042 approved", time: now - 12 * min },
      { id: "5", from: "Jordan Lee", subject: "Draft for the new landing page", time: now - 95 * min }
    ] },
    { id: "outlook:alex.rivera@outlook.com", provider: "outlook", email: "alex.rivera@outlook.com", unread: 1, inboxUrl: "", messages: [
      { id: "6", from: "City Library", subject: "Your reservation is ready for pickup", time: now - 26 * min }
    ] },
    { id: "proton:alexr@proton.me", provider: "proton", email: "alexr@proton.me", unread: 0, inboxUrl: "", messages: [] }
  ]
};

const DEMO_SETTINGS = (theme) => ({
  theme, interval: 2, notify: true, sound: true, preview: true, dnd: true, dndFrom: "22:00", dndTo: "07:00",
  providers: { gmail: true, outlook: true, proton: true },
  accounts: {
    "gmail:alex@studio-rivera.com": { alias: "Studio", color: "#0EA5A4" },
    "proton:alexr@proton.me": { muted: true }
  }
});

function mock(theme) {
  return `
  const MESSAGES = ${JSON.stringify(messages)};
  const SETTINGS = ${JSON.stringify(DEMO_SETTINGS(theme))};
  const STATE = ${JSON.stringify(DEMO_STATE)};
  const noop = async () => {};
  globalThis.browser = {
    i18n: {
      getMessage: (k, subs) => { let m = MESSAGES[k]?.message || ""; [].concat(subs || []).forEach((s, i) => (m = m.replace("$" + (i + 1), s))); return m; },
      getUILanguage: () => "en"
    },
    storage: {
      sync: { get: async () => ({ settings: SETTINGS }), set: noop },
      session: { get: async () => ({ state: STATE }), set: noop },
      onChanged: { addListener: noop }
    },
    runtime: { sendMessage: noop, openOptionsPage: noop, getManifest: () => ({ version: "1.0.0" }), getURL: (p) => p },
    permissions: { contains: async () => true, request: async () => true, remove: noop },
    tabs: { create: noop }
  };`;
}

function page(kind, theme, extraCss = "") {
  const dir = `src/${kind}`;
  let html = read(`${dir}/${kind}.html`);
  const css = read("src/lib/theme.css") + read(`${dir}/${kind}.css`) + (kind === "popup" ? "body{overflow:hidden}" : "") + extraCss;
  const js = read("src/lib/common.js") + "\n" + read(`${dir}/${kind}.js`);
  html = html
    .replace(/<link rel="stylesheet"[^>]*>\s*/g, "")
    .replace(/<link rel="icon"[^>]*>/, "")
    .replace(/<script src="[^"]*"><\/script>\s*/g, "")
    .replace("</head>", () => `<style>${css}</style></head>`)
    .replace("</body>", () => `<script>${mock(theme)}</script><script>${js.replaceAll("../icons/icon.svg", iconData)}</script></body>`)
    .replaceAll("../icons/icon.svg", iconData);
  return html;
}

function frame({ title, sub, chips, theme, inner, innerW, innerH, toolbar = true }) {
  const dark = theme === "dark";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box} html,body{margin:0;width:1280px;height:800px;overflow:hidden}
  body{font-family:"Segoe UI",system-ui,sans-serif;display:flex;align-items:center;gap:56px;padding:0 80px;
    background:${dark ? "radial-gradient(circle at 80% 20%,#2a2350,#111118 60%)" : "radial-gradient(circle at 80% 15%,#e9e4ff,#f7f7fb 60%)"};
    color:${dark ? "#ececf2" : "#17171c"}}
  .copy{flex:1}
  .brand{display:flex;align-items:center;gap:12px;font-weight:700;font-size:22px;margin-bottom:28px}
  .brand img{width:44px;height:44px}
  h1{font-size:54px;line-height:1.05;letter-spacing:-.03em;margin:0 0 18px}
  h1 span{background:linear-gradient(135deg,#4F6BFF,#A855F7);-webkit-background-clip:text;color:transparent}
  p{font-size:20px;line-height:1.5;margin:0 0 28px;color:${dark ? "#a3a3b5" : "#5b5b6b"};max-width:470px}
  .chips{display:flex;flex-wrap:wrap;gap:10px}
  .chip{padding:8px 14px;border-radius:999px;font-weight:600;font-size:15px;background:${dark ? "#22222d" : "#fff"};border:1px solid ${dark ? "#2e2e3b" : "#e6e6ee"}}
  .shot{flex:none;border-radius:16px;overflow:hidden;background:${dark ? "#15151b" : "#fff"};
    box-shadow:0 30px 80px rgb(40 30 90 / ${dark ? ".55" : ".22"}),0 0 0 1px ${dark ? "#2e2e3b" : "#e3e3ec"}}
  .bar{height:44px;display:flex;align-items:center;justify-content:flex-end;gap:14px;padding:0 14px;
    background:${dark ? "#1f1f28" : "#f0f0f4"};border-bottom:1px solid ${dark ? "#2e2e3b" : "#e3e3ec"}}
  .bar .url{flex:1;height:28px;border-radius:8px;background:${dark ? "#2b2a33" : "#fff"}}
  .tb{position:relative;width:28px;height:28px;display:grid;place-items:center;border-radius:6px;background:${dark ? "#33334a" : "#dfdcf7"}}
  .tb img{width:18px;height:18px}
  .tb b{position:absolute;right:-6px;bottom:-4px;background:#E5484D;color:#fff;font:700 10px/1 system-ui;padding:2px 4px;border-radius:6px}
  iframe{display:block;border:0;width:${innerW}px;height:${innerH}px}
  </style></head><body>
  <div class="copy">
    <div class="brand"><img src="${iconData}" alt="">UniNotify</div>
    <h1>${title}</h1><p>${sub}</p>
    <div class="chips">${chips.map((c) => `<span class="chip">${c}</span>`).join("")}</div>
  </div>
  <div class="shot">${toolbar ? `<div class="bar"><span class="url"></span><span class="tb"><img src="${iconData}" alt=""><b>7</b></span></div>` : ""}
    <iframe src="${inner}"></iframe></div>
  </body></html>`;
}

mkdirSync(".tmp", { recursive: true });
mkdirSync("store/screenshots", { recursive: true });
writeFileSync(".tmp/popup-light.html", page("popup", "light"));
writeFileSync(".tmp/popup-dark.html", page("popup", "dark"));
writeFileSync(".tmp/options-light.html", page("options", "light"));
writeFileSync(".tmp/options-dark.html", page("options", "dark", ".wrap>section.panel:first-of-type{display:none}"));

const shots = [
  { file: "1-all-inboxes", theme: "light", inner: "popup-light.html", innerW: 380, innerH: 580,
    title: "All your inboxes.<br><span>One button.</span>",
    sub: "See unread mail from every account at a glance, right in your Firefox toolbar.",
    chips: ["Gmail", "Outlook.com", "Hotmail", "Proton Mail"] },
  { file: "2-dark-mode", theme: "dark", inner: "popup-dark.html", innerW: 380, innerH: 580,
    title: "Light or dark.<br><span>Your call.</span>",
    sub: "A clean, modern look that follows your Firefox theme — or pick one yourself.",
    chips: ["Light", "Dark", "Match Firefox"] },
  { file: "3-private", theme: "light", inner: "options-light.html", innerW: 620, innerH: 640, toolbar: false,
    title: "Private<br><span>by design.</span>",
    sub: "No telemetry. No passwords. No servers. Your mail never leaves your browser.",
    chips: ["Zero tracking", "Open source", "Firefox Sync for settings"] },
  { file: "4-settings-dark", theme: "dark", inner: "options-dark.html", innerW: 620, innerH: 640, toolbar: false,
    title: "Quiet when<br><span>you need it.</span>",
    sub: "Mute any account, set quiet hours and choose how often to check. Light on CPU and battery.",
    chips: ["Quiet hours", "Per-account mute", "Custom names & colors"] }
];

for (const s of shots) {
  writeFileSync(`.tmp/${s.file}.html`, frame(s));
  render(`.tmp/${s.file}.html`, `store/screenshots/${s.file}.png`, 1280, 800);
  console.log("shot", s.file);
}
// Bare popup captures for the README.
render(".tmp/popup-light.html", "store/screenshots/popup-light.png", 380, 580);
render(".tmp/popup-dark.html", "store/screenshots/popup-dark.png", 380, 580);
if (!process.env.KEEP_TMP) rmSync(".tmp", { recursive: true, force: true });
