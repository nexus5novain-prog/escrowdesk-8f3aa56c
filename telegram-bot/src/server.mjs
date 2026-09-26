import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { config, requireBotConfig } from './config.mjs'
import { handleUpdate, handleWalletEvent, verifyWalletSignature } from './bot.mjs'

const same = (left, right) => {
  const a = Buffer.from(String(left || '')); const b = Buffer.from(String(right || ''))
  return a.length === b.length && timingSafeEqual(a, b)
}
const readBody = (request) => new Promise((resolve, reject) => {
  let body = ''; request.on('data', (chunk) => { body += chunk }); request.on('end', () => resolve(body)); request.on('error', reject)
})
const json = (response, status, value) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(value)) }

requireBotConfig()
const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/health') return json(response, 200, { ok: true, service: 'novain-escrowdesk-telegram-bot' })
    if (request.method === 'POST' && request.url === '/telegram/webhook') {
      const body = await readBody(request)
      if (!same(request.headers['x-telegram-bot-api-secret-token'], config.webhookSecret)) return json(response, 401, { ok: false })
      await handleUpdate(JSON.parse(body))
      return json(response, 200, { ok: true })
    }
    if (request.method === 'POST' && request.url === '/wallet/webhook') {
      const body = await readBody(request)
      if (!verifyWalletSignature(body, request.headers['x-wallet-signature'])) return json(response, 401, { ok: false })
      handleWalletEvent(JSON.parse(body))
      return json(response, 200, { ok: true })
    }
    return json(response, 404, { ok: false, error: 'not_found' })
  } catch (error) { console.error(error); return json(response, 500, { ok: false, error: 'internal_error' }) }
})
server.listen(config.port, () => console.log(`Telegram bot listening on ${config.port}`))
