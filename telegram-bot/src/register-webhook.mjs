import { config, requireBotConfig } from './config.mjs'
import { telegram } from './telegram-api.mjs'

requireBotConfig()
if (!config.publicWebhookUrl) throw new Error('Set PUBLIC_WEBHOOK_URL before registering the webhook.')
const result = await telegram('setWebhook', { url: config.publicWebhookUrl, secret_token: config.webhookSecret, allowed_updates: ['message', 'callback_query'] })
console.log(JSON.stringify({ registered: result, url: config.publicWebhookUrl }))
