# MONA Pay Quick View

A Manifest V3 browser extension for Chrome and Edge that shows the latest MONA Pay transactions of a virtual account and creates VietQR codes from the toolbar. It has no third-party dependencies.

## Features

- Popup listing the 10 most recent transactions of one virtual account (VA).
- Quick VietQR creation from an amount and a transfer description; the QR code is drawn locally on a canvas from the EMVCo payload, and the payload string can be copied.
- Toolbar badge counting successful incoming (`credit` / `SUCCESS`) transactions in the last 24 hours, refreshed by the service worker every 5 minutes.
- Options page for credentials, the VA to watch and the six ACB QR settings.

## Install

The extension is loaded unpacked from source.

1. Clone `https://github.com/mona-software/monapay-browser-extension`.
2. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge) and turn on Developer mode.
3. Click **Load unpacked** and select the repository folder (the one containing `manifest.json`).

## Quick start

1. Open the extension's Options page and enter your MONA Pay username, password, Client Secret, the virtual account number to watch and the QR settings from the dashboard.
2. Pin the extension, open the popup and click **Làm mới** (Refresh) to load transactions.
3. To create a QR code, enter an amount and an optional description and click **Tạo QR** (Create QR).

## Configuration

| Option | Purpose |
| --- | --- |
| `username`, `password` | Used to log in and obtain a Bearer token |
| `clientSecret` | Sent as `X-Client-Secret` on write requests (creating a QR) |
| `virtualAccountNumber` | The VA whose transactions are listed and counted |
| `ownerNumber`, `ownerType` (`ORG` or `PER`), `merchantId`, `terminalId`, `virtualAccountPrefix`, `beneficiaryName` | ACB settings for QR creation |

The API origin is fixed to `https://api.monapay.vn`. The extension calls:

- `POST /api/v1/client/login` to log in;
- `GET /api/v1/acb/virtual-account/transactions?virtual_account_number=...&page=1&limit=10` for transactions;
- `POST /api/v1/acb/qr-payment/generate` to create a QR code, with an order ID of the form `EXT<timestamp>`.

Permissions: `storage`, `alarms` and host access to `https://api.monapay.vn/*`.

## CORS and security

`host_permissions` does not bypass the server's CORS policy in every context. The MONA Pay API must allow the extension's origin (`chrome-extension://<extension-id>`), or requests must go through an HTTPS proxy you control. Do not use a public proxy or a CORS-disabling extension.

Username, password, Client Secret and ACB settings are stored in `chrome.storage.local`. This is **not** a secret vault: anyone or any malware with access to the browser profile can read them. Use the extension only on a trusted machine and profile, do not sync extension data, lock the device, limit the account's permissions and revoke the key if you suspect it leaked. The Bearer token is cached only in `chrome.storage.session` and refreshed before it expires.

## Development (tests)

```bash
find . -name '*.js' -not -path './node_modules/*' -print0 | xargs -0 -n1 node --check
node --test
node -e "JSON.parse(require('node:fs').readFileSync('manifest.json')); console.log('manifest OK')"
```

The extension does not ship icons yet; see `icons/README.md`.

Documentation: https://monapay.vn/docs

**MONA Pay is part of MONA Cloud by The MONA Group.**
