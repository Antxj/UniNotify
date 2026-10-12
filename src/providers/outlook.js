"use strict";
// Outlook.com / Hotmail / Live via Microsoft's official Graph API. Each account
// is connected once with Microsoft's own sign-in page (see lib/msauth.js).

(UN.impl = UN.impl || {}).outlook = {
  GRAPH: "https://graph.microsoft.com/v1.0/me/mailFolders/inbox",

  async check(signal) {
    const emails = Object.keys(await UN.ms.accounts());
    if (!emails.length) throw UN.providerError("signed_out", "no account connected");

    const results = await Promise.allSettled(emails.map((email) => this.checkAccount(email, signal)));
    const accounts = [];
    let lastError = null;
    results.forEach((r, i) => {
      if (r.status === "fulfilled") accounts.push(r.value);
      else if (r.reason?.name === "AbortError") throw r.reason;
      else {
        lastError = r.reason;
        // Keep the account visible so the user can see it needs reconnecting.
        accounts.push({ id: `outlook:${emails[i]}`, provider: "outlook", email: emails[i], unread: 0, messages: [],
          inboxUrl: UN.PROVIDERS.outlook.inboxUrl, error: r.reason?.code || "unexpected" });
      }
    });
    if (!accounts.some((a) => !a.error)) throw lastError || UN.providerError("signed_out");
    return accounts;
  },

  async graph(path, token, signal) {
    let res;
    try {
      res = await fetch(this.GRAPH + path, {
        credentials: "omit",
        cache: "no-store",
        headers: { authorization: `Bearer ${token}` },
        signal
      });
    } catch (e) {
      if (e.name === "AbortError") throw e;
      throw UN.providerError("network");
    }
    if (res.status === 401) throw UN.providerError("signed_out");
    if (!res.ok) throw UN.providerError("network", `HTTP ${res.status}`);
    return res.json();
  },

  async checkAccount(email, signal) {
    const token = await UN.ms.accessToken(email);
    const select = "$select=id,subject,from,receivedDateTime,webLink";
    const [folder, list] = await Promise.all([
      this.graph("?$select=unreadItemCount", token, signal),
      this.graph(`/messages?$filter=isRead%20eq%20false&$top=20&${select}`, token, signal)
    ]);

    const messages = (list.value || []).map((m) => ({
      id: m.id,
      from: m.from?.emailAddress?.name || m.from?.emailAddress?.address || "",
      fromEmail: m.from?.emailAddress?.address || "",
      subject: m.subject || "",
      snippet: "",
      time: Date.parse(m.receivedDateTime) || 0,
      url: UN.safeUrl(m.webLink || "", "outlook")
    }));
    messages.sort((a, b) => b.time - a.time);

    return {
      id: `outlook:${email}`,
      provider: "outlook",
      email,
      unread: folder.unreadItemCount || 0,
      messages,
      inboxUrl: UN.PROVIDERS.outlook.inboxUrl
    };
  }
};
