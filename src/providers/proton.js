"use strict";
// Proton Mail: uses the same API the Proton web app uses, authenticated by the
// session cookie Proton already set in Firefox. Only metadata is read (unread
// count, sender, subject) — message bodies stay end-to-end encrypted and are
// never requested.

(UN.impl = UN.impl || {}).proton = {
  API: "https://mail.proton.me/api",
  INBOX: "0", // Proton's label id for the inbox

  async check(signal) {
    // Each signed-in Proton session has an "AUTH-<UID>" cookie. We only read the
    // cookie *name* to learn the session id; its value is never touched.
    const cookies = await browser.cookies.getAll({ domain: "mail.proton.me", firstPartyDomain: null });
    const uids = [...new Set(cookies.filter((c) => c.name.startsWith("AUTH-")).map((c) => c.name.slice(5)))];
    if (!uids.length) throw UN.providerError("signed_out");

    const appVersion = await this.appVersion(signal);
    const accounts = [];
    const seen = new Set();
    let lastError = null;

    for (const uid of uids) {
      try {
        const acc = await this.checkSession(uid, appVersion, signal);
        if (seen.has(acc.id)) continue; // stale duplicate session
        seen.add(acc.id);
        accounts.push(acc);
      } catch (e) {
        if (e.name === "AbortError") throw e;
        lastError = e;
      }
    }
    if (!accounts.length) throw lastError || UN.providerError("signed_out");
    return accounts;
  },

  async api(path, uid, appVersion, signal) {
    let res;
    try {
      res = await fetch(this.API + path, {
        credentials: "include",
        cache: "no-store",
        headers: { "x-pm-uid": uid, "x-pm-appversion": appVersion, accept: "application/vnd.protonmail.v1+json" },
        signal
      });
    } catch (e) {
      if (e.name === "AbortError") throw e;
      throw UN.providerError("network");
    }
    if (res.status === 401 || res.status === 403) throw UN.providerError("signed_out");
    let body;
    try {
      body = await res.json();
    } catch (_) {
      throw UN.providerError("unexpected", `HTTP ${res.status}`);
    }
    if (body.Code !== 1000) throw UN.providerError(res.ok ? "unexpected" : "network", `Proton code ${body.Code}`);
    return body;
  },

  async checkSession(uid, appVersion, signal) {
    const [user, counts, list] = await Promise.all([
      this.api("/core/v4/users", uid, appVersion, signal),
      this.api("/mail/v4/messages/count", uid, appVersion, signal),
      this.api(`/mail/v4/messages?LabelID=${this.INBOX}&Unread=1&Page=0&PageSize=20&Sort=Time&Desc=1`, uid, appVersion, signal)
    ]);

    const email = user.User?.Email || user.User?.Name || uid;
    const inbox = (counts.Counts || []).find((c) => c.LabelID === this.INBOX);
    const messages = (list.Messages || []).map((m) => ({
      id: m.ID,
      from: m.Sender?.Name || m.Sender?.Address || "",
      fromEmail: m.Sender?.Address || "",
      subject: m.Subject || "",
      snippet: "",
      time: (m.Time || 0) * 1000,
      url: `https://mail.proton.me/inbox/${encodeURIComponent(m.ID)}`
    }));

    return {
      id: `proton:${email.toLowerCase()}`,
      provider: "proton",
      email,
      name: user.User?.DisplayName || "",
      unread: inbox ? inbox.Unread : messages.length,
      messages,
      inboxUrl: UN.PROVIDERS.proton.inboxUrl
    };
  },

  // Proton's API requires the web app's version in a header; read it from the
  // web app itself so we never send an outdated value.
  async appVersion(signal) {
    const cached = (await browser.storage.session.get("protonVersion")).protonVersion;
    if (cached && Date.now() - cached.at < 6 * 3600e3) return cached.value;
    let value = "web-mail@5.0.999.999";
    try {
      const res = await fetch("https://mail.proton.me/assets/version.json", { cache: "no-store", signal });
      const v = (await res.json()).version;
      if (/^\d+(\.\d+){1,3}$/.test(v)) value = `web-mail@${v}`;
    } catch (e) {
      if (e.name === "AbortError") throw e;
    }
    await browser.storage.session.set({ protonVersion: { value, at: Date.now() } });
    return value;
  }
};
