const csv = (value, fallback = '') =>
  (value || fallback)
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)

export const config = {
  port: Number(process.env.PORT || 8787),
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  publicWebhookUrl: process.env.PUBLIC_WEBHOOK_URL || '',
  walletServiceUrl: (process.env.WALLET_SERVICE_URL || '').replace(/\/$/, ''),
  walletServiceApiKey: process.env.WALLET_SERVICE_API_KEY || '',
  walletWebhookSecret: process.env.WALLET_WEBHOOK_SECRET || '',
  supportedAssets: csv(process.env.SUPPORTED_ASSETS, 'BTC'),
  dealsChannelId: process.env.DEALS_CHANNEL_ID || '',
  updatesChannelUrl: process.env.UPDATES_CHANNEL_URL || '',
  botChannelUrl: process.env.BOT_CHANNEL_URL || ''
}

export function requireBotConfig() {
  const missing = []
  if (!config.botToken) missing.push('TELEGRAM_BOT_TOKEN')
  if (!config.webhookSecret) missing.push('TELEGRAM_WEBHOOK_SECRET')
  if (missing.length) throw new Error(`Missing required bot configuration: ${missing.join(', ')}`)
}

export function isSupportedAsset(asset) {
  return config.supportedAssets.includes(String(asset || '').trim().toUpperCase())
}

export function channels() {
  return {
    deals: config.dealsChannelId || null,
    updates: config.updatesChannelUrl || null,
    bot: config.botChannelUrl || null
  }
}
