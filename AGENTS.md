# Project Architecture Decisions

- The Telegram escrow bot is isolated under `telegram-bot/` and does not import or call the web app; this prevents bot release logic from being coupled to browser routes.
- Telegram group escrow records are created only from an existing group because Telegram Bot API bots cannot create new groups; the bot can export an invite link after it has group-admin permission.
- The bot runs in SIMULATION_MODE until real wallets and chain watchers are connected; no real crypto moves in simulation.
- The Telegram bot is a standalone Python (aiogram + Telethon userbot) app using SQLite; it runs on its own server, never inside the web app, and needs a durable database before real funds.
