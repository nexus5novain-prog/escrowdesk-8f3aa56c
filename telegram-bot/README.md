# NOVAIN ESCROWDESK — Standalone Telegram Bot

This package is intentionally separate from the web application. It is the Telegram escrow infrastructure layer: it links Telegram users, assigns escrow groups, requests provider-generated wallet addresses, tracks funding events, and controls release/refund confirmations.

## What is implemented now

- Private `/start`, `/help`, `/about`, `/instructions`, and `/terms` with one permanent welcome layout and the same buttons.
- Automatic linking of every sender to their Telegram user ID and the chat where they interacted.
- Group-only `/create ASSET AMOUNT` with a short escrow ID and group assignment.
- `/buyer ESCROW_ID` and `/seller ESCROW_ID` role identifiers.
- Provider-generated escrow address requested after the creator selects a role.
- `/status`, `/release`, and `/refund` with two-party confirmation buttons.
- Signed wallet-provider webhook boundary for funding notifications.
- Official deals/update/bot channel placeholders that can be filled later.
- Telegram webhook secret validation and wallet webhook HMAC validation.

## Important Telegram limitation

The Telegram Bot API does not let a bot create a brand-new group. The bot therefore creates the escrow record inside an existing group, assigns that group an escrow ID, and requests an invite link when it has administrator permission. This is the safe and supported equivalent of “create escrow group.”

## Run locally

```bash
cp .env.example .env
# Fill the bot token, webhook secret, and wallet provider values.
npm start
npm run register-webhook
```

The webhook endpoint is `POST /telegram/webhook`; health is `GET /health`.

## Wallet provider contract

The bot never invents an address and never stores a private key. Configure a wallet service that implements:

- `POST /v1/escrow/wallets` → `{ "walletId": "...", "address": "...", "network": "..." }`
- `POST /v1/escrow/release` → provider settlement acknowledgement
- `POST /v1/escrow/refund` → provider refund acknowledgement
- `POST /wallet/webhook` → signed funding events such as `{ "escrowId": "ED-...", "status": "funded", "txid": "..." }`

Use a real custody provider before accepting funds. The included JSON repository is only a development starter and is not sufficient for multi-instance production or financial records.

## Channel rollout

Set `DEALS_CHANNEL_ID` after creating the official deal channel. Set `UPDATES_CHANNEL_URL` and `BOT_CHANNEL_URL` after creating the updates and verification destinations. Until then, the bot clearly shows “to be configured” rather than presenting unofficial links.

## Visibility rule

In private replies the bot does not display usernames. In group messages and configured channel posts it may show a username or Telegram ID, matching the requested visibility rule.
