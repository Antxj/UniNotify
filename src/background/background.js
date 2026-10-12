"use strict";
// Background event page. Wakes up on an alarm, checks every enabled provider,
// updates the toolbar badge, raises notifications, then goes back to sleep.

const ALARM = "poll";
const BADGE_COLOR = "#E5484D";
const BADGE_IDLE = "#8B8D98";
const PROVIDER_ORDER = Object.keys(UN.PROVIDERS);
let running = null;

// ---------- scheduling ----------

async function ensureAlarm(settings) {
  const s = settings || (await UN.getSettings());
  const period = Math.max(1, Number(s.interval) || UN.DEFAULTS.interval);
  const alarm = await browser.alarms.get(ALARM);
  if (!alarm || alarm.periodInMinutes !== period) {
    browser.alarms.create(ALARM, { periodInMinutes: period, delayInMinutes: period });
  }
}

function checkAll() {
  // Coalesce overlapping requests (popup open + alarm + tab title change).
  if (!running) running = runCheck().finally(() => (running = null));
  return running;
}

async function runCheck() {
  const settings = await UN.getSettings();
  const prev = await UN.getState();
  await browser.storage.session.set({ state: { ...prev, checking: true } });

  const providers = {};
  const accounts = [];
  const active = [];
  for (const id of PROVIDER_ORDER) {
    if (settings.providers[id] && (await UN.hasProviderPermission(id))) active.push(id);
    else providers[id] = { enabled: !!settings.providers[id], granted: false };
  }

  if (!navigator.onLine) {
    for (const id of active) providers[id] = { enabled: true, granted: true, error: "offline" };
    const keep = prev.accounts.filter((a) => active.includes(a.provider));
    return finish(settings, { accounts: keep, providers, lastCheck: prev.lastCheck }, prev);
  }

  const results = await Promise.allSettled(active.map((id) => UN.impl[id].check(AbortSignal.timeout(25000))));
  results.forEach((r, i) => {
    const id = active[i];
    if (r.status === "fulfilled") {
      providers[id] = { enabled: true, granted: true, error: null };
      accounts.push(...r.value);
    } else {
      const code = r.reason?.code || (r.reason?.name === "TimeoutError" ? "network" : "unexpected");
      providers[id] = { enabled: true, granted: true, error: code, detail: String(r.reason?.message || "") };
      // On transient errors keep showing the last known data for that provider.
      if (code !== "signed_out") accounts.push(...prev.accounts.filter((a) => a.provider === id).map((a) => ({ ...a, stale: true })));
    }
  });

  return finish(settings, { accounts, providers, lastCheck: Date.now() }, prev);
}

async function finish(settings, state, prev) {
  state.checking = false;
  await notifyNew(settings, state.accounts);
  await browser.storage.session.set({ state });
  await updateBadge(settings, state);
  return state;
}

// ---------- badge ----------

async function updateBadge(settings, state) {
  settings = settings || (await UN.getSettings());
  state = state || (await UN.getState());
  const visible = state.accounts.filter((a) => !settings.accounts[a.id]?.hidden);
  const total = visible.reduce((n, a) => n + (a.unread || 0), 0);
  const anyEnabled = Object.values(settings.providers).some(Boolean);
  const allFailing = anyEnabled && !state.accounts.length && Object.values(state.providers || {}).some((p) => p.enabled);

  let text = total > 999 ? "999+" : total ? String(total) : "";
  if (!total && allFailing) text = "!";
  browser.action.setBadgeText({ text });
  browser.action.setBadgeBackgroundColor({ color: total ? BADGE_COLOR : BADGE_IDLE });
  browser.action.setBadgeTextColor({ color: "#FFFFFF" });
  browser.action.setTitle({ title: total ? `UniNotify — ${UN.t("unreadCount", [String(total)])}` : "UniNotify" });
}

// ---------- notifications ----------

function inQuietHours(s) {
  if (!s.dnd) return false;
  const toMin = (hm) => {
    const [h, m] = String(hm).split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const from = toMin(s.dndFrom);
  const to = toMin(s.dndTo);
  return from <= to ? cur >= from && cur < to : cur >= from || cur < to;
}

async function notifyNew(settings, accounts) {
  const { seen = {} } = await browser.storage.session.get("seen");
  const quiet = !settings.notify || inQuietHours(settings);
  let rang = false;

  for (const acc of accounts) {
    if (acc.stale) continue;
    const ids = acc.messages.map((m) => m.id);
    const before = seen[acc.id];
    seen[acc.id] = { ids, unread: acc.unread };
    // First sighting of an account in this browser session: just remember it.
    if (!before) continue;

    const known = new Set(before.ids);
    const fresh = acc.messages.filter((m) => !known.has(m.id));
    const count = fresh.length || Math.max(0, acc.unread - before.unread);
    const pref = settings.accounts[acc.id] || {};
    if (!count || quiet || pref.muted || pref.hidden) continue;

    const label = UN.accountLabel(acc, settings);
    const lines = settings.preview
      ? fresh.slice(0, 3).map((m) => (m.from ? `${m.from}: ${m.subject}` : m.subject)).join("\n")
      : "";
    browser.notifications.create(`acc|${acc.id}|${Date.now()}`, {
      type: "basic",
      iconUrl: browser.runtime.getURL("icons/icon.svg"),
      title: count > 1 ? UN.t("notifNewMany", [String(count), label]) : UN.t("notifNewOne", [label]),
      message: lines || UN.t("notifOpenHint")
    });
    rang = true;
  }

  await browser.storage.session.set({ seen });
  if (rang && settings.sound) UN.chime();
}

// ---------- opening the webmail ----------

function tabBase(acc, providerId) {
  if (providerId === "gmail" && acc?.inboxUrl) return acc.inboxUrl.split("#")[0];
  return new URL(UN.PROVIDERS[providerId].origins[0].replace("/*", "/")).href;
}

async function openMail({ accountId, url }) {
  const state = await UN.getState();
  const acc = state.accounts.find((a) => a.id === accountId);
  const providerId = acc?.provider || String(accountId).split(":")[0];
  if (!UN.PROVIDERS[providerId]) return;

  const target = url ? UN.safeUrl(url, providerId) : acc?.inboxUrl || UN.PROVIDERS[providerId].inboxUrl;
  const base = tabBase(acc, providerId);
  let tab = null;
  try {
    const tabs = await browser.tabs.query({ url: UN.PROVIDERS[providerId].origins });
    tab = tabs.find((t) => t.url && t.url.startsWith(base));
  } catch (_) {}

  if (tab) {
    await browser.tabs.update(tab.id, url ? { url: target, active: true } : { active: true });
    await browser.windows.update(tab.windowId, { focused: true });
  } else {
    await browser.tabs.create({ url: target });
  }
  // The user is likely about to read mail; refresh shortly after.
  setTimeout(checkAll, 15000);
}

// ---------- events ----------

browser.runtime.onInstalled.addListener(async ({ reason }) => {
  await ensureAlarm();
  if (reason === "install") browser.runtime.openOptionsPage();
  checkAll();
});

browser.runtime.onStartup.addListener(async () => {
  await ensureAlarm();
  checkAll();
});

browser.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) checkAll();
});

browser.runtime.onMessage.addListener((msg, sender) => {
  // Only accept messages from our own pages.
  if (sender.id !== browser.runtime.id) return;
  if (msg?.type === "check") return checkAll();
  if (msg?.type === "open") return openMail(msg);
});

browser.notifications.onClicked.addListener((nid) => {
  const [, accountId] = nid.split("|");
  browser.notifications.clear(nid);
  openMail({ accountId });
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes.settings) return;
  const before = changes.settings.oldValue || {};
  const after = changes.settings.newValue || {};
  ensureAlarm();
  if (JSON.stringify(before.providers) !== JSON.stringify(after.providers)) checkAll();
  else updateBadge();
});

browser.permissions.onAdded.addListener(() => checkAll());
browser.permissions.onRemoved.addListener(() => checkAll());

// When a webmail tab's title changes (e.g. "Inbox (3)"), the unread count most
// likely changed too. Refresh soon after, debounced.
let titleTimer = null;
browser.tabs.onUpdated.addListener(
  () => {
    clearTimeout(titleTimer);
    titleTimer = setTimeout(checkAll, 4000);
  },
  { urls: Object.values(UN.PROVIDERS).flatMap((p) => p.origins), properties: ["title"] }
);
