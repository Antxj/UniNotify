# UniNotify Privacy Policy

_Last updated: October 11, 2026_

UniNotify is a Firefox extension that shows unread mail from your webmail accounts. It was designed to collect nothing.

## What UniNotify does **not** do

- It does not collect, sell, share or transmit any personal data to the developer or to any third party.
- It contains no telemetry, analytics, crash reporting, advertising or tracking code.
- It does not ask for, read or store your passwords.
- It does not run on, read or change any website other than the mail services you turn on.

## What UniNotify accesses, and why

When you turn on a mail service, UniNotify contacts **only that service's own servers** to fetch your unread mail:

| Service | Website contacted | What is read |
|---|---|---|
| Gmail | `mail.google.com` | Unread count, sender, subject and short preview of unread inbox messages |
| Outlook.com / Hotmail | `login.microsoftonline.com`, `graph.microsoft.com` | Unread count, sender and subject of unread inbox messages (Microsoft's `Mail.ReadBasic` permission, which excludes message bodies and attachments) |
| Proton Mail | `mail.proton.me` | Unread count, sender and subject of unread inbox messages (message bodies are never requested) |

For Gmail and Proton Mail, these requests use the session you already have open in Firefox, the same way the webmail page itself does.

For Outlook.com / Hotmail, you connect each account once through Microsoft's own sign-in page, where you approve read access to basic mail information. UniNotify never sees your Microsoft password. Microsoft returns access tokens, which UniNotify keeps **only on your computer**, in the extension's local storage. They are never synced or sent anywhere except to Microsoft. Turning Outlook off, or choosing **Disconnect**, deletes them. You can also revoke access at any time at https://account.live.com/consent/Manage. For Proton Mail, UniNotify reads the **names** of Proton's session cookies on `mail.proton.me` to identify your signed-in session. Cookie values are never read. While Proton Mail is turned on, a tiny script on `mail.proton.me` pages reads the session id of each signed-in Proton account from that page's storage, so a message opens in the right account. It reads nothing else, and the result stays in your browser.

The extension's built-in security policy blocks connections to any other website.

## Where data is stored

- **Mail information** (counts, senders, subjects) is kept only in Firefox's temporary session storage, in memory. It is erased when Firefox closes and is never written to disk or synced.
- **Microsoft sign-in tokens** (Outlook only) are kept in the extension's local storage on this computer, as described above.
- **Your preferences** (check interval, theme, notification settings, quiet hours, and the nickname, color and mute choice for each account, keyed by email address) are stored with Firefox's `storage.sync`. If you use a Firefox Account with add-on sync turned on, Mozilla's Firefox Sync carries them between your devices. Otherwise they stay on your computer. See [Mozilla's Privacy Notice](https://www.mozilla.org/privacy/firefox/) for how Firefox Sync handles data.

## Permissions

| Permission | Why |
|---|---|
| Access to `mail.google.com`, `mail.proton.me`, `graph.microsoft.com`, `login.microsoftonline.com`, `outlook.live.com` (optional) | Requested only when you turn that service on; removed when you turn it off. `outlook.live.com` is used only to switch to an Outlook tab you already have open |
| Identity | To show Microsoft's sign-in page when you connect an Outlook account |
| Cookies (optional, Proton Mail only) | To find your Proton session, as described above |
| Scripting | To run the small Proton helper described above, only on `mail.proton.me` and only while Proton Mail is turned on |
| Notifications | To tell you about new mail |
| Storage | To remember your preferences |
| Alarms | To check for new mail periodically while the extension sleeps in between |

## Changes

Any change to this policy will be published in this repository along with the corresponding release.

## Contact

Questions? Please open an issue at https://github.com/Antxj/UniNotify/issues.
