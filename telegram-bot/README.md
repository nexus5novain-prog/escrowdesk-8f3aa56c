# EscrowDesk Bot

Automated Telegram escrow bot inspired by Stealth Escrow.

**Brand:** EscrowDesk  
**Bot:** @EscrowDeskBot

## Features

- Stealth-style welcome message + inline buttons
- Full command menu (same as Stealth Escrow)
- `/create` — create escrow deal (auto group with userbot)
- Role registration: `/seller ADDRESS` · `/buyer ADDRESS`
- Network selection (TRC20, ERC20, BEP20, BTC, LTC, TON)
- `/pay_seller` · `/refund_buyer` · `/balance` · `/qr` · `/blockchain`
- `/contact` · `/real` · `/review` · `/userinfo` · `/leaderboard` · `/refer` · `/setpin`
- Forward blocking in escrow groups
- Simulation mode for safe testing
- Telethon userbot for automatic private group creation

## Quick Start

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure `.env`

Copy and edit:

```bash
cp .env.example .env
```

Required:
- `BOT_TOKEN` — from @BotFather
- `ADMIN_IDS_RAW` — your Telegram user ID
- `API_ID` + `API_HASH` — from https://my.telegram.org (for auto group creation)

### 3. Userbot login (one-time, for automatic /create)

```bash
python login_userbot.py
```

Enter your phone number (international format, e.g. +19787083816), then the code Telegram sends you.

### 4. Run the bot

```bash
python bot.py
```

## How users use it

1. `/start` → see welcome + buttons
2. `/create` or tap **CREATE ESCROW GROUP**
3. Join the group, share link with other party
4. Both register: `/seller WALLET` and `/buyer WALLET`
5. Select network → buyer deposits
6. After delivery: `/pay_seller` or `/refund_buyer`

## Simulation mode

With `SIMULATION_MODE=True`:
- Use `/simulate_deposit` in the group to fake a deposit
- No real crypto is moved

Set to `False` only when real wallets and chain watchers are connected.

## Project structure

```
bot.py              Main entry
config.py           Settings
handlers/
  start.py          /start, help, terms, menu commands
  escrow.py         /create, roles, deposit, release
services/
  userbot.py        Telethon group creation
database/
  models.py         SQLite storage
keyboards/
  inline.py         Buttons + BotCommand list
```

## License

Private / your use.
