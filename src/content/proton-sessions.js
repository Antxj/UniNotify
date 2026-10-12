"use strict";
// Runs on mail.proton.me only. Proton keeps one "ps-<n>" entry per signed-in
// account in localStorage, where <n> is the number in its /u/<n>/ URLs. We read
// just the session id (UID) of each entry so UniNotify can open a message in
// the right account. Nothing else is read, and nothing leaves the browser.
(() => {
  const map = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const m = /^ps-(\d+)$/.exec(localStorage.key(i) || "");
      if (!m) continue;
      const uid = JSON.parse(localStorage.getItem(m[0]) || "{}").UID;
      if (typeof uid === "string" && /^[\w-]{1,128}$/.test(uid)) map[uid] = Number(m[1]);
    }
  } catch (_) {}
  if (Object.keys(map).length) browser.runtime.sendMessage({ type: "protonSessions", map });
})();
