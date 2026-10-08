# Project Architecture Decisions

- The Telegram escrow bot is hosted inside the web app: `src/routes/api/public/telegram/webhook.ts` handles all updates, with group-escrow logic in `src/lib/telegram/group-escrow.server.ts`; this avoids any external server or VPS.
- Group escrow deals are stored in `public.tg_escrow_deals` (Supabase), not in the bot's local files; the standalone `telegram-bot/` Python app is deprecated and must not run on the same bot token.
- Telegram group escrow records are created only from an existing group because Telegram Bot API bots cannot create new groups; the bot can export an invite link after it has group-admin permission.
- BTC Telegram deals get a unique per-deal address from a BTCPay invoice and auto-fund via the signed BTCPay webhook (most secure path, no shared address); LTC/TRC20 use fixed env wallets (`ESCROW_WALLET_LTC/TRC20`) and are admin-confirmed via `/confirm_deposit AMOUNT TXID`. Payouts are manual: the bot notifies admins after release/refund approval.
- Admin chat IDs come from `TELEGRAM_ADMIN_IDS` (default 7371453715); the webhook secret is derived from `TELEGRAM_API_KEY` via SHA-256 base64url.
