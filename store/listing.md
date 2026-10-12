# addons.mozilla.org listing

Text to paste into the AMO developer hub.

## Name
UniNotify

## Summary (max 250 characters)
Unread mail from Gmail, Outlook.com, Hotmail and Proton Mail in one toolbar button. Private by design: no telemetry, no passwords, no servers. Notifications, quiet hours, light and dark themes.

## Description
**All your inboxes. One button.**

UniNotify shows how many unread emails you have across Gmail, Outlook.com/Hotmail and Proton Mail, right in your Firefox toolbar. Click the button to see who wrote and what about, then jump straight to the message.

<b>Features</b>
<ul>
<li>One badge with the unread count for every account</li>
<li>Peek at sender and subject without switching tabs</li>
<li>Desktop notifications with an optional soft chime</li>
<li>Multiple accounts per service (e.g. personal and work Gmail)</li>
<li>Nicknames and colors per account; mute or hide any account</li>
<li>Quiet hours</li>
<li>Light and dark themes, or match Firefox</li>
<li>Preferences sync with your Firefox Account</li>
<li>Very light: sleeps between checks</li>
</ul>

<b>Private by design</b>
<ul>
<li>No telemetry, analytics or tracking. No servers.</li>
<li>No passwords: it uses the webmail session you already have in Firefox.</li>
<li>It talks only to Google, Microsoft and Proton, and only for the services you turn on. The extension's security policy blocks everything else.</li>
<li>Mail info stays in memory and is cleared when Firefox closes.</li>
<li>Open source (MPL-2.0).</li>
</ul>

UniNotify is an independent project, not affiliated with Google, Microsoft or Proton.

## Categories
Alerts & Updates; Privacy & Security

## Tags
email, gmail, outlook, hotmail, proton, notifier, notifications, unread

## Support / homepage
https://github.com/Antxj/UniNotify

## Privacy policy
Paste the contents of PRIVACY.md.

## License
Mozilla Public License 2.0

## Notes to reviewer
No build step and no third-party code; the submitted files are the source.
To test: enable a provider in the options page, then sign in to that webmail in Firefox (Gmail, Proton) or click "Connect an Outlook account" (Outlook, Microsoft OAuth 2.0 + PKCE, scope Mail.ReadBasic).
Gmail uses the official Atom feed (mail.google.com/mail/u/N/feed/atom). Outlook uses the official Microsoft Graph API (graph.microsoft.com) with tokens from login.microsoftonline.com via browser.identity.launchWebAuthFlow. Proton uses the mail.proton.me/api endpoints of its web app, identified by the AUTH-<uid> cookie name.

## Assets
- Icon: store/icons/icon-128.png
- Screenshots (1280x800): store/screenshots/1-all-inboxes.png, 2-dark-mode.png, 3-private.png, 4-settings-dark.png
