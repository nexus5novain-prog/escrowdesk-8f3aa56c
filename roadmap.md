# Roadmap

- [x] Host the Telegram escrow bot inside the web app webhook (no VPS/external server).
- [x] Store group escrow deals in Lovable Cloud (`tg_escrow_deals`) instead of bot-local storage.
- [x] Port group commands: /create, /start_deal, /buyer, /seller, network choice, /confirm_deposit, /pay_seller, /refund_buyer, /balance, /qr, /contact.
- [ ] Reconnect the Telegram connector with the new bot token, then register the webhook + command menu.
- [ ] Add real escrow wallet addresses (ESCROW_WALLET_BTC/LTC/TRC20) and set DEALS_CHANNEL_ID.
- [ ] Provision the two official Telegram channels (deals feed + updates).
- [ ] Automatic wallet generation, on-chain monitoring and automatic payouts (needs a custody/wallet service).
