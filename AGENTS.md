# Project Architecture Decisions

- The Telegram escrow bot is isolated under `telegram-bot/` and does not import or call the web app; this prevents bot release logic from being coupled to browser routes.
- Telegram group escrow records are created only from an existing group because Telegram Bot API bots cannot create new groups; the bot can export an invite link after it has group-admin permission.
- Wallet custody is behind a provider-neutral HTTP adapter and never generates fake addresses; this keeps private-key custody outside the bot and permits a production wallet service to be selected later.
- The starter bot uses a local JSON repository for immediate development only; a durable transactional database is required before production funds are accepted.
