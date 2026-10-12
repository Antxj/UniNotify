"use strict";
// Shared helpers for the background page, popup and options page.
// Plain script (no modules) so every page can load it with a single <script>.

const UN = (globalThis.UN = {});

UN.PROVIDERS = {
  gmail: {
    name: "Gmail",
    letter: "G",
    color: "#EA4335",
    origins: ["https://mail.google.com/*"],
    permissions: [],
    inboxUrl: "https://mail.google.com/mail/u/0/#inbox",
    loginUrl: "https://mail.google.com/mail/u/0/#inbox"
  },
  outlook: {
    name: "Outlook.com / Hotmail",
    letter: "O",
    color: "#0A6CD6",
    // outlook.live.com is only used to find an already-open Outlook tab.
    origins: ["https://outlook.live.com/*", "https://graph.microsoft.com/*", "https://login.microsoftonline.com/*"],
    permissions: [],
    inboxUrl: "https://outlook.live.com/mail/0/",
    loginUrl: "https://outlook.live.com/mail/0/"
  },
  proton: {
    name: "Proton Mail",
    letter: "P",
    color: "#6D4AFF",
    origins: ["https://mail.proton.me/*"],
    permissions: ["cookies"],
    inboxUrl: "https://mail.proton.me/inbox",
    loginUrl: "https://account.proton.me/login"
  }
};

UN.DEFAULTS = Object.freeze({
  interval: 2, // minutes
  theme: "auto", // auto | light | dark
  notify: false,
  sound: true,
  preview: true, // show sender & subject in notifications
  listCount: 3, // emails listed per account in the popup (0 = counts only)
  listSubject: true, // show subjects in the popup
  showDetails: true, // popup eye toggle: list emails, or show counts only
  dnd: false,
  dndFrom: "22:00",
  dndTo: "07:00",
  providers: { gmail: false, outlook: false, proton: false },
  accounts: {} // "<provider>:<email>" -> { alias, color, muted, hidden }
});

// Settings live in storage.sync so they follow the user's Firefox Account.
// Mail data never goes there.
UN.getSettings = async function () {
  const { settings } = await browser.storage.sync.get("settings");
  const s = Object.assign({}, UN.DEFAULTS, settings || {});
  s.providers = Object.assign({}, UN.DEFAULTS.providers, s.providers);
  s.accounts = Object.assign({}, s.accounts);
  return s;
};

UN.saveSettings = async function (patch) {
  const s = Object.assign(await UN.getSettings(), patch);
  await browser.storage.sync.set({ settings: s });
  return s;
};

// Errors carry a short code the UI can translate: signed_out | network | unexpected.
UN.providerError = function (code, detail) {
  const e = new Error(detail || code);
  e.code = code;
  return e;
};

UN.getState = async function () {
  const { state } = await browser.storage.session.get("state");
  return state || { accounts: [], lastCheck: 0, checking: false };
};

UN.hasProviderPermission = function (id) {
  const p = UN.PROVIDERS[id];
  return browser.permissions.contains({ origins: p.origins, permissions: p.permissions });
};

UN.t = function (key, subs) {
  return browser.i18n.getMessage(key, subs) || key;
};

// Tiny DOM builder. Text is always set via textContent — never innerHTML.
UN.h = function (tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "style") el.style.cssText = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
};

UN.svg = function (pathData, size = 18) {
  const ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("width", size);
  s.setAttribute("height", size);
  s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", pathData);
  s.append(p);
  return s;
};

UN.ICONS = {
  refresh: "M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
  settings: "M19.14 12.94a7.14 7.14 0 0 0 0-1.88l2.03-1.58a.48.48 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54A.48.48 0 0 0 13.93 2h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.73 8.47a.47.47 0 0 0 .12.61l2.03 1.58a7.3 7.3 0 0 0 0 1.88l-2.03 1.58a.48.48 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z",
  external: "M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zM5 5h5v2H5v12h12v-5h2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
  muted: "M20 18.69 7.84 6.14 5.27 3.49 4 4.76l2.8 2.8v.01c-.52.99-.8 2.16-.8 3.42v5l-2 2v1h13.73l2 2L21 19.72l-1-1.03zM12 22c1.11 0 2-.89 2-2h-4c0 1.11.89 2 2 2zm6-7.32V11c0-3.08-1.64-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68c-.15.03-.29.08-.42.12-.1.03-.2.07-.3.11h-.01c-.01 0-.01 0-.02.01-.23.09-.46.2-.68.31 0 0-.01 0-.01.01L18 14.68z",
  warn: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
  eye: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  eyeOff: "M12 7a5 5 0 0 1 5 5c0 .65-.13 1.26-.36 1.83l2.92 2.92A11.8 11.8 0 0 0 23 12c-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16A4.85 4.85 0 0 1 12 7zM2 4.27l2.28 2.28.46.46A11.8 11.8 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55A2.8 2.8 0 0 0 9 12a3 3 0 0 0 3 3c.22 0 .44-.03.65-.08l1.55 1.55A4.97 4.97 0 0 1 7 12c0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16a3 3 0 0 0-3-3l-.17.01z"
};

UN.applyTheme = function (theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
};

UN.localizePage = function () {
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = UN.t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-title]")) {
    el.title = UN.t(el.dataset.i18nTitle);
    el.setAttribute("aria-label", el.title);
  }
};

UN.relTime = function (ts) {
  if (!ts) return "";
  const rtf = new Intl.RelativeTimeFormat(browser.i18n.getUILanguage(), { numeric: "auto", style: "short" });
  const diff = (ts - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 604800) return rtf.format(Math.round(diff / 86400), "day");
  return new Date(ts).toLocaleDateString(browser.i18n.getUILanguage(), { day: "numeric", month: "short" });
};

// Only ever open links that point at the provider's own web app.
UN.safeUrl = function (url, providerId) {
  try {
    const u = new URL(url);
    const allowed = UN.PROVIDERS[providerId].origins.map((o) => new URL(o.replace("/*", "/")).origin);
    if (u.protocol === "https:" && allowed.includes(u.origin)) return u.href;
  } catch (_) {}
  return UN.PROVIDERS[providerId].inboxUrl;
};

UN.accountLabel = function (acc, settings) {
  const pref = settings.accounts[acc.id] || {};
  return pref.alias || acc.email || acc.name || UN.PROVIDERS[acc.provider].name;
};

// A short two-note chime synthesised on the fly — no audio file shipped.
UN.chime = function () {
  try {
    const ctx = new AudioContext();
    const t0 = ctx.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = t0 + i * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
    setTimeout(() => ctx.close(), 900);
  } catch (_) {}
};
