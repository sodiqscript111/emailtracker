# Email Open Tracker

A lightweight, self-hosted personal email tracking system for Gmail built with Cloudflare Workers, Cloudflare D1 (SQLite), Chrome Extension (Manifest V3), and a React + TypeScript dashboard.

### 👥 Packaging for Friends (No Coding / No IDE Required!)

1. Run `npm run package:extension` to generate the extension zip file.
2. Send your friends the generated `email-tracker-extension.zip`.
3. Tell them to right-click and **Extract / Unzip** it on their laptop.
4. In Google Chrome, go to `chrome://extensions` and turn on **Developer mode** (top right toggle).
5. Click **Load unpacked** and select the unzipped folder.
6. That's it! When they send an email in Gmail, it automatically attributes the tracking to their sender address. You can view all activity together on the dashboard or filter by sender!

### 💻 Live Terminal Activity Monitor

Run in your terminal to see tracking status and recipient opens in real time:
```bash
npm run activity
# Or keep it running with live updates every 5s:
npm run activity -- --watch
```

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Gmail Web Interface                      │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Chrome Extension (Manifest V3)                      │   │
│   │  - GmailAdapter (Centralized DOM selectors)         │   │
│   │  - ComposeObserver (Debounced MutationObserver)     │   │
│   │  - Tracking Toggle UI (Default OFF)                 │   │
│   │  - Pixel Injector (1x1 Transparent GIF)             │   │
│   └──────────┬────────────────────────────────▲─────────┘   │
└──────────────┼────────────────────────────────┼─────────────┘
               │ 1. POST /api/tracked-emails    │
               │    (Bearer token auth)         │
               │                                │
               ▼                                │
┌────────────────────────────────┐              │
│   Cloudflare Worker Backend    │              │
│   (Hono / TypeScript)          │              │
│                                │              │
│   - GET /health                │              │
│   - POST /api/tracked-emails   │              │
│   - GET /api/tracked-emails/:id│              │
│   - GET /t/o/:trackingId       │              │
│     (1x1 GIF + no-cache)       │              │
│     (HMAC-SHA256 IP Hash)      │              │
└──────────────┬─────────────────┘              │
               │                                │
               ▼                                │
┌────────────────────────────────┐              │
│   Cloudflare D1 (SQLite)       │              │
│   - tracked_emails             │              │
│   - open_events                │              │
│   - Foreign keys & cascades    │              │
└──────────────▲─────────────────┘              │
               │                                │
               │ Read / Manage                  │
               │                                │
┌──────────────┴─────────────────┐              │
│   React Dashboard (Vite)       │              │
│   - Overview metrics           │              │
│   - Status table & pagination  │              │
│   - Detailed timeline drawer   │              │
│   - Token authentication       │              │
└────────────────────────────────┘              │
                                                │
Recipient Email Client ─────────────────────────┘
  (Loads tracking pixel: GET /t/o/:trackingId)
```

---

## Repository Structure

```text
email-tracker/
├── apps/
│   ├── extension/              # Chrome Extension (Manifest V3)
│   │   ├── src/
│   │   │   ├── background/     # Service worker
│   │   │   ├── content/
│   │   │   │   ├── gmail/      # GmailAdapter (centralized DOM selectors)
│   │   │   │   ├── compose/    # Compose detection & inline UI toggle
│   │   │   │   └── tracking/   # Pixel injector utility
│   │   │   ├── popup/          # Extension popup UI
│   │   │   ├── options/        # Extension settings page
│   │   │   └── lib/            # Storage & API client
│   │   ├── public/             # Manifest & icons
│   │   └── vite.config.ts      # Multi-entry extension bundler
│   │
│   ├── dashboard/              # Web Dashboard (React + TypeScript)
│   │   ├── src/
│   │   │   ├── api/            # API client with token storage
│   │   │   ├── components/     # OverviewCards, EmailTable, EmailDetailDrawer, AuthModal
│   │   │   ├── App.tsx         # Main dashboard view
│   │   │   └── main.tsx
│   │   └── vite.config.ts
│   │
│   └── worker/                 # Cloudflare Worker Backend (Hono)
│       ├── src/
│       │   ├── routes/         # /health, /t/o/:trackingId, /api/*
│       │   ├── middleware/     # CORS, Bearer token authentication
│       │   ├── services/       # D1 database queries & HMAC-SHA256 IP hashing
│       │   └── index.ts        # Worker entrypoint & structured observability
│       ├── migrations/         # D1 SQL migrations
│       └── wrangler.toml       # Local and production Worker configuration
│
├── packages/
│   └── shared/                 # Shared TypeScript types, schemas, and constants
│
├── tests/                      # Automated test suite (Worker, D1, Extension, Pipeline)
├── package.json                # NPM workspaces configuration
├── vitest.config.ts            # Test runner configuration
└── README.md
```

---

## Important Tracking Semantics & Limitations

> [!IMPORTANT]
> A tracking event indicates that **the tracking resource was requested** by an email client, image proxy, or security scanner. It does **not** definitively prove a human opened or read the message.

1. **Proxy Pre-fetching**: Modern clients such as Apple Mail (Privacy Protection) and Google Workspace image proxies automatically fetch images at delivery time before a user opens the email.
2. **Image Blocking**: If a recipient disables remote image loading by default, open events will not fire until they manually click "Load remote images".
3. **Repeated Requests**: Email clients frequently reload images during search or re-rendering. The system records all raw events and displays `Total Requests`, `First Opened`, and `Last Opened`.

---

## Privacy Protection

- **No Raw IP Storage**: Recipient IP addresses are **never** stored in plain text. IPs are hashed on the server using `HMAC-SHA256(IP_SALT, client_ip)`.
- **High-Entropy Opaque Identifiers**: Tracking URLs use random 128-bit cryptographic hex identifiers (`/t/o/01kabc...`). The recipient's email address and subject are never embedded in the URL.
- **Constant Response**: Requests to nonexistent or malformed tracking IDs return the exact same 1x1 transparent GIF with identical headers and status code 200, preventing tracking ID enumeration.
- **No Email Body Storage**: The database only stores metadata (`recipient_email`, `subject`, timestamps, status). Email contents remain exclusively in Gmail.

---

## Local Development Quickstart

Cloudflare's Wrangler tools simulate the Cloudflare Worker runtime and SQLite D1 database locally without requiring external cloud resources.

### 1. Prerequisites

- Node.js `v20+` (tested with Node `v22.14.0`)
- npm `v10+`

### 2. Install Dependencies

```bash
npm install
```

### 3. Apply Local D1 Database Migrations

Run the local D1 migration in the worker directory:

```bash
cd apps/worker
npx wrangler d1 migrations apply email_tracker_db --local
cd ../..
```

### 4. Start the Local Backend Worker

```bash
npm run dev:worker
```

The Worker will start on `http://localhost:8787`. You can verify health:

```bash
curl http://localhost:8787/health
# {"status":"ok"}
```

### 5. Start the React Dashboard

In a separate terminal:

```bash
npm run dev:dashboard
```

The dashboard will open on `http://localhost:5173`.

---

## Chrome Extension Installation (Unpacked)

### 1. Build the Extension

```bash
npm run build:extension
```

The compiled extension files are output to `apps/extension/dist`.

### 2. Load into Google Chrome

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select the `apps/extension/dist` folder from this repository.
5. The **Email Open Tracker** icon will appear in your Chrome toolbar.

### 3. Extension Configuration

1. Click the extension icon in the Chrome toolbar, then click **Options** (or right-click the icon and choose **Options**).
2. Confirm the settings:
   - **Worker API Base URL**: `http://localhost:8787` (for local dev)
   - **API Authentication Token**: `dev-secret-token-change-in-prod`
   - **Dashboard URL**: `http://localhost:5173`
   - **Enable tracking by default**: Toggle ON or OFF (defaults to OFF).
3. Click **Save Settings**.

---

## Using with Gmail

1. Open [mail.google.com](https://mail.google.com).
2. Click **Compose** (or Reply/Forward).
3. In the bottom action toolbar next to the Send button, you will see:
   ```text
   ☑ Track email [ON]
   ```
4. Enter a recipient email address and subject.
5. Click **Send** (or press Ctrl+Enter / Cmd+Enter).
6. The extension registers the tracking ID with the Worker, injects the transparent 1x1 GIF into the body, and allows Gmail to send normally.
7. When the recipient client requests the pixel, view the open event in your dashboard (`http://localhost:5173`) or extension popup.

---

## Automated Tests

Run the full test suite covering Worker endpoints, D1 SQLite cascades, HMAC IP hashing, and extension logic:

```bash
npm test
```

All 23 automated tests run against in-memory SQLite and verify:
- `GET /health` returns 200 OK.
- Bearer token authentication and CORS preflight handling.
- `POST /api/tracked-emails` input validation and secure ID generation.
- `GET /t/o/:trackingId` 1x1 transparent GIF delivery and strict cache control headers.
- Open event logging with HMAC-SHA256 IP hashing.
- Cascade deletion when emails are removed.
- Pagination and dashboard overview statistics.

---

## Production Cloudflare Deployment

Once local testing is complete, you can deploy to Cloudflare Workers and D1:

### 1. Create Production D1 Database

```bash
cd apps/worker
npx wrangler d1 create email_tracker_db
```

Copy the returned `database_id` into `apps/worker/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "email_tracker_db"
database_id = "<YOUR_PRODUCTION_DATABASE_ID>"
```

### 2. Apply Remote Migrations

```bash
npx wrangler d1 migrations apply email_tracker_db --remote
```

### 3. Set Production Secrets

```bash
npx wrangler secret put API_AUTH_TOKEN
npx wrangler secret put IP_SALT
```

### 4. Deploy Worker

```bash
npx wrangler deploy
```

### 5. Update Extension and Dashboard Settings

- In `apps/extension`: update options to use your production Worker domain (e.g. `https://email-tracker-worker.<account>.workers.dev`).
- In `apps/dashboard`: configure the dashboard to point to your production Worker URL and token.

---

## Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **"Cannot connect to backend"** | Worker is not running or port mismatch | Ensure `npm run dev:worker` is running on `http://localhost:8787`. |
| **401 Unauthorized in Dashboard** | API Token mismatch | Verify the token in Dashboard Settings matches `API_AUTH_TOKEN` in `wrangler.toml` or Cloudflare secrets. |
| **Compose checkbox not appearing** | Gmail DOM altered or not loaded | The extension uses resilient fallback selectors in `GmailAdapter`. Refresh Gmail or inspect `console.log` messages from `[Email Tracker]`. |
| **Tracking warning: "one recipient"** | Multiple recipients entered | MVP supports 1 recipient per email to guarantee attribution integrity. |

---

## License

Personal and private use. MIT License.
