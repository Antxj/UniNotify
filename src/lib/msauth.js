"use strict";
// Microsoft sign-in for Outlook.com / Hotmail (OAuth 2.0 authorization code +
// PKCE, public client — there is no client secret and no UniNotify server).
// Only the "Mail.ReadBasic" scope is requested: sender, subject and dates,
// never message bodies or attachments.

UN.ms = {
  // Public identifier of the UniNotify app registration in Microsoft Entra.
  // Not a secret: every public client ships its client id.
  CLIENT_ID: "d99c6d96-f078-4165-8ccd-9d560aa5a58d",
  AUTHORITY: "https://login.microsoftonline.com/consumers/oauth2/v2.0",
  SCOPES: "openid email profile offline_access https://graph.microsoft.com/Mail.ReadBasic",

  b64url(bytes) {
    return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },

  randomString(n = 48) {
    return this.b64url(crypto.getRandomValues(new Uint8Array(n)));
  },

  // Refresh tokens live in storage.local on this computer only (never synced).
  async accounts() {
    const { msAccounts = {} } = await browser.storage.local.get("msAccounts");
    return msAccounts;
  },

  async saveAccount(email, data) {
    const all = await this.accounts();
    all[email] = { ...all[email], ...data };
    await browser.storage.local.set({ msAccounts: all });
  },

  async removeAccount(email) {
    const all = await this.accounts();
    delete all[email];
    await browser.storage.local.set({ msAccounts: all });
    const { msTokens = {} } = await browser.storage.session.get("msTokens");
    delete msTokens[email];
    await browser.storage.session.set({ msTokens });
  },

  // Sign-in. Interactive mode must be started from a user click. Silent mode
  // (prompt=none) reuses the Microsoft login already in Firefox to renew access
  // when the refresh token expires — browser-based apps get 24-hour ones.
  async connect({ interactive = true, loginHint = "" } = {}) {
    if (!this.CLIENT_ID) throw UN.providerError("unexpected", "Microsoft client id not configured");
    const verifier = this.randomString(64);
    const challenge = this.b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    const state = this.randomString(16);
    const redirect = browser.identity.getRedirectURL();
    const url = new URL(`${this.AUTHORITY}/authorize`);
    url.search = new URLSearchParams({
      client_id: this.CLIENT_ID,
      response_type: "code",
      response_mode: "query",
      redirect_uri: redirect,
      scope: this.SCOPES,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      prompt: interactive ? "select_account" : "none",
      ...(loginHint ? { login_hint: loginHint } : {})
    });

    let result;
    try {
      result = new URL(await browser.identity.launchWebAuthFlow({ url: url.href, interactive }));
    } catch (e) {
      throw UN.providerError(interactive ? "unexpected" : "signed_out", e.message);
    }
    const params = result.searchParams;
    if (params.get("state") !== state) throw UN.providerError("unexpected", "state mismatch");
    if (params.get("error")) throw UN.providerError("unexpected", params.get("error_description") || params.get("error"));

    const tok = await this.tokenRequest({
      grant_type: "authorization_code",
      code: params.get("code"),
      redirect_uri: redirect,
      code_verifier: verifier
    });
    const claims = this.idClaims(tok.id_token);
    const email = String(claims.email || claims.preferred_username || "").toLowerCase();
    if (!email) throw UN.providerError("unexpected", "no email in id token");
    if (loginHint && email !== loginHint) throw UN.providerError("signed_out", "different account");
    await this.saveAccount(email, { refreshToken: tok.refresh_token, name: claims.name || "" });
    await this.cacheAccess(email, tok);
    return email;
  },

  idClaims(idToken) {
    try {
      const part = idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(decodeURIComponent(escape(atob(part))));
    } catch (_) {
      return {};
    }
  },

  async tokenRequest(params) {
    let res;
    try {
      res = await fetch(`${this.AUTHORITY}/token`, {
        method: "POST",
        credentials: "omit",
        cache: "no-store",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: this.CLIENT_ID, scope: this.SCOPES, ...params })
      });
    } catch (e) {
      if (e.name === "AbortError") throw e;
      throw UN.providerError("network");
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.access_token) {
      const code = body.error === "invalid_grant" || body.error === "interaction_required" ? "signed_out" : "unexpected";
      throw UN.providerError(code, body.error_description || body.error || `HTTP ${res.status}`);
    }
    return body;
  },

  async cacheAccess(email, tok) {
    const { msTokens = {} } = await browser.storage.session.get("msTokens");
    msTokens[email] = { access: tok.access_token, exp: Date.now() + (tok.expires_in || 3600) * 1000 };
    await browser.storage.session.set({ msTokens });
  },

  // Returns a valid access token, refreshing it (and rotating the refresh token) when needed.
  async accessToken(email) {
    const { msTokens = {} } = await browser.storage.session.get("msTokens");
    const cached = msTokens[email];
    if (cached && cached.exp - Date.now() > 120e3) return cached.access;

    const acc = (await this.accounts())[email];
    if (!acc) throw UN.providerError("signed_out");
    let tok;
    try {
      if (!acc.refreshToken) throw UN.providerError("signed_out");
      tok = await this.tokenRequest({ grant_type: "refresh_token", refresh_token: acc.refreshToken });
    } catch (e) {
      if (e.code !== "signed_out") throw e;
      await this.connect({ interactive: false, loginHint: email });
      return (await browser.storage.session.get("msTokens")).msTokens[email].access;
    }
    if (tok.refresh_token) await this.saveAccount(email, { refreshToken: tok.refresh_token });
    await this.cacheAccess(email, tok);
    return tok.access_token;
  }
};
