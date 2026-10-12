"use strict";
// Outlook.com / Hotmail / Live: both brands run on outlook.live.com. We ask the
// web app's own bootstrap endpoint (the one the page calls on load) for the
// inbox folder and the first page of conversations, using the open session.

(UN.impl = UN.impl || {}).outlook = {
  async check(signal) {
    let res;
    try {
      res = await fetch("https://outlook.live.com/owa/0/sessiondata.ashx?app=Mail", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "x-req-source": "Mail" },
        signal
      });
    } catch (e) {
      // Signed out: the redirect to login.live.com is blocked by our CSP.
      if (e.name === "AbortError") throw e;
      throw UN.providerError("signed_out");
    }
    if (res.status === 401 || res.status === 440 || res.redirected) throw UN.providerError("signed_out");
    if (!res.ok) throw UN.providerError("network", `HTTP ${res.status}`);

    let data;
    try {
      data = await res.json();
    } catch (_) {
      throw UN.providerError("signed_out");
    }

    const inbox = this.find(data, (o) => o.DistinguishedFolderId === "inbox" && typeof o.UnreadCount === "number");
    if (!inbox) throw UN.providerError("unexpected", "inbox folder not found");

    const email = this.findValue(data, ["UserEmailAddress", "LogonEmailAddress"]) || "";
    const name = this.findValue(data, ["UserDisplayName"]) || "";

    const conversations = [];
    this.walk(data, (o) => {
      if (typeof o.ConversationTopic === "string" && o.UnreadCount > 0 && o.ConversationId?.Id) conversations.push(o);
    });

    const messages = conversations.slice(0, 20).map((c) => {
      const sender = (Array.isArray(c.UniqueSenders) && c.UniqueSenders[0]) || c.From?.Mailbox?.Name || "";
      return {
        id: c.ConversationId.Id,
        from: String(sender),
        subject: c.ConversationTopic,
        snippet: typeof c.Preview === "string" ? c.Preview : "",
        time: Date.parse(c.LastDeliveryTime) || 0,
        url: `https://outlook.live.com/mail/0/inbox/id/${encodeURIComponent(c.ConversationId.Id)}`
      };
    });
    messages.sort((a, b) => b.time - a.time);

    const key = (email || name || "default").toLowerCase();
    return [
      {
        id: `outlook:${key}`,
        provider: "outlook",
        email,
        name,
        unread: inbox.UnreadCount,
        messages,
        inboxUrl: UN.PROVIDERS.outlook.inboxUrl
      }
    ];
  },

  // Depth-first walk over the (large, loosely documented) JSON payload.
  walk(node, visit, depth = 0) {
    if (!node || typeof node !== "object" || depth > 40) return;
    if (!Array.isArray(node)) visit(node);
    for (const v of Object.values(node)) if (v && typeof v === "object") this.walk(v, visit, depth + 1);
  },

  find(node, pred) {
    let hit = null;
    this.walk(node, (o) => {
      if (!hit && pred(o)) hit = o;
    });
    return hit;
  },

  findValue(node, keys) {
    const o = this.find(node, (x) => keys.some((k) => typeof x[k] === "string" && x[k]));
    return o ? keys.map((k) => o[k]).find((v) => typeof v === "string" && v) : null;
  }
};
