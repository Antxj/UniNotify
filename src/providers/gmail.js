"use strict";
// Gmail: reads Google's official Atom feed using the session already open in
// Firefox. Every signed-in Google account is exposed as /mail/u/<n>/.

(UN.impl = UN.impl || {}).gmail = {
  MAX_ACCOUNTS: 6,

  async check(signal) {
    const accounts = [];
    const seen = new Set();
    for (let i = 0; i < this.MAX_ACCOUNTS; i++) {
      const acc = await this.fetchFeed(i, signal);
      if (!acc || seen.has(acc.email)) break; // out of signed-in accounts
      seen.add(acc.email);
      accounts.push(acc);
    }
    if (!accounts.length) throw UN.providerError("signed_out");
    return accounts;
  },

  async fetchFeed(index, signal) {
    let res;
    try {
      res = await fetch(`https://mail.google.com/mail/u/${index}/feed/atom`, {
        credentials: "include",
        cache: "no-store",
        signal
      });
    } catch (e) {
      // A signed-out session redirects to the Google login page, which our CSP
      // (rightly) refuses to load. Treat that as "no account at this index".
      if (e.name === "AbortError") throw e;
      return null;
    }
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.includes("xml")) return null;

    const doc = new DOMParser().parseFromString(await res.text(), "application/xml");
    if (doc.querySelector("parsererror")) return null;
    const text = (el, sel) => (el.querySelector(sel)?.textContent || "").trim();

    // Feed title: "Gmail - Inbox for someone@gmail.com"
    const email = (text(doc, "feed > title").match(/[^\s]+@[^\s]+/) || [])[0];
    if (!email) return null;

    const messages = [...doc.querySelectorAll("entry")].map((e) => ({
      id: text(e, "id"),
      from: text(e, "author > name") || text(e, "author > email"),
      fromEmail: text(e, "author > email"),
      subject: text(e, "title"),
      snippet: text(e, "summary"),
      time: Date.parse(text(e, "issued") || text(e, "modified")) || 0,
      url: UN.safeUrl(e.querySelector("link")?.getAttribute("href") || "", "gmail")
    }));

    return {
      id: `gmail:${email.toLowerCase()}`,
      provider: "gmail",
      email,
      unread: parseInt(text(doc, "fullcount"), 10) || 0,
      messages,
      inboxUrl: `https://mail.google.com/mail/u/${index}/#inbox`
    };
  }
};
