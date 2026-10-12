"use strict";
const { h, t, svg, ICONS, PROVIDERS } = UN;
const MAX_MSGS = 5;
const app = document.getElementById("app");
let settings = null;
let state = null;

function avatar(providerId, color) {
  const p = PROVIDERS[providerId];
  const bg = /^#[0-9a-f]{6}$/i.test(color || "") ? color : p.color;
  return h("span", { class: "avatar", style: `background:${bg}`, "aria-hidden": "true" }, p.letter);
}

function open(accountId, url) {
  browser.runtime.sendMessage({ type: "open", accountId, url });
  window.close();
}

function errorText(code) {
  return t({ signed_out: "errSignedOut", offline: "errOffline", network: "errNetwork", permission: "errPermission" }[code] || "errUnexpected");
}

function renderHeader(total) {
  const refresh = h("button", { class: "icon-btn" + (state.checking ? " spinning" : ""), title: t("refresh"), "aria-label": t("refresh"), onclick: refreshNow }, svg(ICONS.refresh));
  const gear = h("button", { class: "icon-btn", title: t("settings"), "aria-label": t("settings"), onclick: () => { browser.runtime.openOptionsPage(); window.close(); } }, svg(ICONS.settings));
  return h("header", null,
    h("img", { class: "logo", src: "../icons/icon.svg", alt: "" }),
    h("h1", null, "UniNotify"),
    total ? h("span", { class: "total", title: t("unreadCount", [String(total)]) }, String(total)) : null,
    h("span", { class: "spacer" }),
    refresh,
    gear);
}

function renderAccount(acc) {
  const pref = settings.accounts[acc.id] || {};
  const label = UN.accountLabel(acc, settings);
  const sub = label !== acc.email && acc.email ? acc.email : PROVIDERS[acc.provider].name;
  const msgs = acc.messages.slice(0, MAX_MSGS);

  return h("section", { class: "account" },
    h("button", { class: "account-head", onclick: () => open(acc.id), title: t("openInbox") },
      avatar(acc.provider, pref.color),
      h("span", { class: "who" }, h("div", { class: "label" }, label), h("div", { class: "sub" }, sub)),
      pref.muted ? h("span", { class: "muted-icon", title: t("muted") }, svg(ICONS.muted, 16)) : null,
      h("span", { class: "count" + (acc.unread ? "" : " zero") }, String(acc.unread))),
    msgs.length
      ? h("ul", { class: "msgs" },
          msgs.map((m) => h("li", null,
            h("button", { class: "msg", onclick: () => open(acc.id, m.url), title: m.snippet || m.subject },
              h("span", { class: "from" }, m.from || "—"),
              h("span", { class: "time" }, UN.relTime(m.time)),
              h("span", { class: "subject" }, m.subject || t("noSubject"))))),
          acc.unread > msgs.length ? h("li", { class: "more" }, t("moreUnread", [String(acc.unread - msgs.length)])) : null)
      : null);
}

function renderProviderNotice(id, info) {
  const code = info.granted === false ? "permission" : info.error;
  const action = code === "signed_out"
    ? h("button", { onclick: () => { browser.tabs.create({ url: PROVIDERS[id].loginUrl }); window.close(); } }, t("signIn"))
    : code === "permission"
      ? h("button", { onclick: () => { browser.runtime.openOptionsPage(); window.close(); } }, t("grant"))
      : null;
  return h("section", { class: "account" },
    h("div", { class: "account-head", style: "cursor:default" },
      avatar(id),
      h("span", { class: "who" }, h("div", { class: "label" }, PROVIDERS[id].name), h("div", { class: "sub" }, errorText(code)))),
    h("div", { class: "notice" }, svg(ICONS.warn, 16), h("span", null, errorText(code)), action));
}

function renderEmpty() {
  return h("div", { class: "empty" },
    h("img", { class: "art", src: "../icons/icon.svg", alt: "" }),
    h("h2", null, t("emptyTitle")),
    h("p", null, t("emptyBody")),
    h("button", { class: "btn primary", onclick: () => { browser.runtime.openOptionsPage(); window.close(); } }, t("addAccounts")));
}

function render() {
  UN.applyTheme(settings.theme);
  const visible = state.accounts.filter((a) => !settings.accounts[a.id]?.hidden);
  const total = visible.reduce((n, a) => n + (a.unread || 0), 0);
  const enabled = Object.keys(PROVIDERS).filter((id) => settings.providers[id]);
  const providers = state.providers || {};

  const items = [];
  for (const id of enabled) {
    const accs = visible.filter((a) => a.provider === id);
    const info = providers[id];
    if (accs.length) items.push(...accs.map(renderAccount));
    else if (info && (info.error || info.granted === false)) items.push(renderProviderNotice(id, info));
  }

  const body = !enabled.length
    ? renderEmpty()
    : items.length
      ? h("div", { class: "list" }, items)
      : h("div", { class: "empty" }, h("p", null, state.checking ? t("checking") : t("noMail")));

  app.replaceChildren(
    renderHeader(total),
    body,
    enabled.length
      ? h("footer", null,
          h("span", null, state.lastCheck ? t("lastChecked", [UN.relTime(state.lastCheck)]) : ""),
          h("span", null, t("noTelemetry")))
      : null);
}

async function refreshNow() {
  state = { ...state, checking: true };
  render();
  await browser.runtime.sendMessage({ type: "check" });
}

async function init() {
  [settings, state] = await Promise.all([UN.getSettings(), UN.getState()]);
  render();
  if (Date.now() - (state.lastCheck || 0) > 30000) browser.runtime.sendMessage({ type: "check" });
}

browser.storage.onChanged.addListener(async (changes, area) => {
  if (area === "session" && changes.state) state = changes.state.newValue || state;
  else if (area === "sync" && changes.settings) settings = await UN.getSettings();
  else return;
  render();
});

init();
