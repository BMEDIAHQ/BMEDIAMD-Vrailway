# BMEDIA-MD — Railway deployment

This build is prepared for a Railway long-running **Service** using Railway's current Railpack deployment flow.

## Verified before deployment

Railway currently allows new users to start the Free Trial **without a credit card**. The trial gives a one-time $5 grant for up to 30 days. After the trial, the account falls back to the $0 Free plan, which currently provides $1 of usage credit each month.

There is one important account-verification issue for BMEDIA-MD: Railway automatically assigns either a **Full Trial** or **Limited Trial**. Railway explicitly says GitHub account age and activity are factors in this verification. A very new GitHub account can therefore receive Limited Trial. Limited Trial can deploy code, but outbound networking is restricted. BMEDIA-MD requires outbound access to WhatsApp and MongoDB, so a Full Trial is strongly preferred.

If you have an older, established GitHub account, use it for Railway verification if possible. If you want the code to remain under a new official BMEDIA GitHub account, you can keep the repository there and grant the established account access to it where GitHub/Railway permissions allow.

## Free-tier reality

Railway is card-free to start, but it is not safe to assume this main bot will remain continuously online forever on the post-trial $1/month Free allowance.

Railway bills compute usage. BMEDIA-MD is a persistent WhatsApp bot with a live Baileys connection and has historically used materially more memory than a tiny idle web app. Use the $5 trial to measure real monthly usage. If the estimated monthly cost exceeds the later $1 Free credit, Railway will not be a permanent always-on free home for this bot.

Do **not** enable Railway Serverless/App Sleeping for this bot. BMEDIA-MD continuously makes outbound network traffic for WhatsApp/database connectivity, and Railway counts outbound traffic as activity. UptimeRobot is therefore not needed to keep Railway awake when Serverless is disabled, and it would not solve the Free-credit limit.

## What this build already handles

- Listens on Railway's injected `PORT` and `0.0.0.0`.
- `GET /health` returns HTTP 200.
- WhatsApp auth is restored from the BMEDIA pairing MongoDB session.
- Updated Baileys auth is continuously synced back to MongoDB.
- The pairing session's temporary TTL is removed once the main bot claims it.
- Important runtime JSON state and `assets/logo.png` are backed up to MongoDB.
- Commands are lazy-loaded from `commands/manifest.json` to reduce startup memory.
- `.env` is excluded from Git. Production secrets belong in Railway Variables.

## Railway build/start settings

Railway's current Railpack system auto-detects Node.js and the `npm start` script from `package.json`, so no special build configuration file is required.

Use:

- Builder: Railpack (automatic)
- Build command: leave automatic/default
- Start command: `npm start` (automatic from `package.json`; set manually only if Railway does not detect it)
- Healthcheck path: `/health`
- Serverless/App Sleeping: **OFF**
- Restart policy: restart on failure/default is fine

Railway injects `PORT` automatically. Do not hard-code a different public port in the dashboard.

## Required variables

Copy your real values from the private `.env` into Railway's **Variables** section. At minimum:

```env
SESSION_ID=
MONGODB_URI=
SESSION_DB_NAME=bmedia_sessions
SESSION_COLLECTION=sessions
SESSION_SYNC_DEBOUNCE_MS=1500

PHONE_NUMBER=
OWNER_NUMBER=
PREFIX=!
BOT_MODE=public
TIMEZONE=Africa/Douala
BOT_NAME=BMEDIA-MD
AUTHOR=BMEDIA
```

Also copy every other variable required by the commands you actually use, such as API keys and channel/repository metadata. Do not commit the real `.env`.

## Deployment sequence

1. Push this folder's contents to the GitHub repository root.
2. Create/sign in to Railway. The Free Trial does not require a credit card.
3. Connect GitHub and check whether Railway shows **Full Trial** or **Limited Trial**.
4. If Limited Trial is shown, do not assume WhatsApp/MongoDB will work: outbound access is restricted. Try verification with an established GitHub account before spending time debugging the bot itself.
5. Create a new Railway project and deploy from the GitHub repository.
6. Add the environment variables under the service's Variables tab.
7. In Service Settings, set the healthcheck path to `/health` if Railway has not detected one.
8. Keep Serverless/App Sleeping disabled.
9. Generate a public domain only if you want to open `/health` from a browser; the WhatsApp bot itself does not require public web traffic to stay running.
10. Check logs for WhatsApp connection and test several commands.
11. Watch Railway Usage during the trial for several days. Use that estimate before deciding whether the post-trial $1/month Free allowance is enough.

## Why this is different from Render/Koyeb

Railway does not require an uptime monitor when the service remains persistent. The main constraint is usage credit, not inactivity sleeping. The most important signup check is whether Railway grants Full Trial networking, especially when using a newly created GitHub account.
