"use strict";
const { h, t, PROVIDERS } = UN;
const $ = (id) => document.getElementById(id);
let settings = null;
let state = null;
let granted = {};

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 1600);
}

async function save(patch, quiet) {
  settings = await UN.saveSettings(patch);
  if (!quiet) toast(t("saved"));
}

// ---------- general settings ----------

function bindGeneral() {
  const fields = { interval: "value", theme: "value", notify: "checked", preview: "checked", sound: "checked", dnd: "checked", dndFrom: "value", dndTo: "value" };
  for (const [key, prop] of Object.entries(fields)) {
    const el = $(key);
    el[prop] = settings[key];
    el.addEventListener("change", () => {
      const v = key === "interval" ? Number(el.value) : el[prop];
      save({ [key]: v });
      if (key === "theme") UN.applyTheme(v);
    });
  }
  $("testSound").addEventListener("click", () => UN.chime());
}

// ---------- providers & accounts ----------

async function toggleProvider(id, on) {
  const p = PROVIDERS[id];
  if (on) {
    // Must be the first await in the click handler so Firefox sees a user gesture.
    const ok = await browser.permissions.request({ origins: p.origins, permissions: p.permissions });
    if (!ok) return renderProviders();
    await save({ providers: { ...settings.providers, [id]: true } });
  } else {
    await save({ providers: { ...settings.providers, [id]: false } });
    // Give the access back: we don't keep permissions we no longer need.
    // Only drop "cookies" if no other enabled provider still uses it.
    const stillNeeded = new Set(Object.keys(PROVIDERS).filter((k) => settings.providers[k]).flatMap((k) => PROVIDERS[k].permissions));
    await browser.permissions.remove({ origins: p.origins, permissions: p.permissions.filter((x) => !stillNeeded.has(x)) });
  }
  await refreshGranted();
  renderProviders();
}

async function grant(id) {
  const p = PROVIDERS[id];
  if (await browser.permissions.request({ origins: p.origins, permissions: p.permissions })) {
    await refreshGranted();
    renderProviders();
  }
}

function statusLine(id) {
  const enabled = settings.providers[id];
  const info = state.providers?.[id];
  const accs = state.accounts.filter((a) => a.provider === id);
  if (!enabled) return h("div", { class: "status" }, h("span", { class: "dot" }), t("statusOff"));
  if (!granted[id])
    return h("div", { class: "status warn" }, h("span", { class: "dot" }), t("errPermission"),
      h("button", { class: "linklike", onclick: () => grant(id) }, t("grant")));
  if (info?.error === "signed_out")
    return h("div", { class: "status warn" }, h("span", { class: "dot" }), t("errSignedOut"),
      h("a", { href: PROVIDERS[id].loginUrl, target: "_blank", rel: "noopener noreferrer" }, t("signIn")));
  if (info?.error)
    return h("div", { class: "status warn", title: info.detail || "" }, h("span", { class: "dot" }),
      t({ offline: "errOffline", network: "errNetwork" }[info.error] || "errUnexpected"));
  if (accs.length) return h("div", { class: "status ok" }, h("span", { class: "dot" }), t("statusConnected", [String(accs.length)]));
  return h("div", { class: "status" }, h("span", { class: "dot" }), t("checking"));
}

function accountRow(acc) {
  const pref = settings.accounts[acc.id] || {};
  const update = (patch) => {
    const next = { ...settings.accounts, [acc.id]: { ...pref, ...settings.accounts[acc.id], ...patch } };
    save({ accounts: next });
  };
  let aliasTimer;
  const color = /^#[0-9a-f]{6}$/i.test(pref.color || "") ? pref.color : PROVIDERS[acc.provider].color;
  return h("div", { class: "acc" },
    h("input", { type: "color", value: color, title: t("color"), "aria-label": t("color"), onchange: (e) => update({ color: e.target.value }) }),
    h("div", null,
      h("input", { type: "text", value: pref.alias || "", placeholder: acc.email || acc.name || "", maxlength: "40", "aria-label": t("alias"),
        oninput: (e) => { clearTimeout(aliasTimer); aliasTimer = setTimeout(() => update({ alias: e.target.value.trim() }), 500); } }),
      h("div", { class: "email" }, acc.email)),
    h("div", { class: "toggles" },
      h("label", null, h("input", { type: "checkbox", class: "switch", checked: !!pref.muted, onchange: (e) => update({ muted: e.target.checked }) }), t("mute")),
      h("label", null, h("input", { type: "checkbox", class: "switch", checked: !!pref.hidden, onchange: (e) => update({ hidden: e.target.checked }) }), t("hide"))));
}

function renderProviders() {
  const list = Object.keys(PROVIDERS).map((id) => {
    const p = PROVIDERS[id];
    const accs = state.accounts.filter((a) => a.provider === id);
    const sw = h("input", { type: "checkbox", class: "switch", checked: !!settings.providers[id], "aria-label": p.name,
      onchange: (e) => toggleProvider(id, e.target.checked) });
    return h("div", { class: "provider" },
      h("div", { class: "provider-head" },
        h("span", { class: "avatar", style: `background:${p.color}`, "aria-hidden": "true" }, p.letter),
        h("div", { class: "info" }, h("div", { class: "name" }, p.name), statusLine(id)),
        sw),
      settings.providers[id] && accs.length ? h("div", { class: "acc-list" }, accs.map(accountRow)) : null);
  });
  $("providers").replaceChildren(...list);
}

async function refreshGranted() {
  for (const id of Object.keys(PROVIDERS)) granted[id] = await UN.hasProviderPermission(id);
}

async function init() {
  UN.localizePage();
  [settings, state] = await Promise.all([UN.getSettings(), UN.getState()]);
  UN.applyTheme(settings.theme);
  $("version").textContent = `UniNotify ${browser.runtime.getManifest().version}`;
  await refreshGranted();
  bindGeneral();
  renderProviders();
}

browser.storage.onChanged.addListener(async (changes, area) => {
  if (area === "session" && changes.state) {
    state = changes.state.newValue || state;
    // Don't rebuild while the user is typing an alias.
    if (!document.activeElement?.matches?.("input[type=text]")) renderProviders();
  }
});

init();
