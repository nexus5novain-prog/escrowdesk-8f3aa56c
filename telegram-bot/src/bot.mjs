import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from './config.mjs'
import { answerCallback, editMessage, exportInviteLink, getChatMember, sendMessage, telegram } from './telegram-api.mjs'
import { addEvent, getMembership, getUser, upsertUser, setMembership } from './store.mjs'
import { actionKeyboard, aboutText, helpText, instructionsText, roleKeyboard, termsText, welcomeKeyboard, welcomeText } from './content.mjs'
import { assignRole, confirmRefund, confirmRelease, createEscrow, requestRefund, requestRelease, statusFor } from './escrow-service.mjs'

const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const args = (text) => text.trim().split(/\s+/).slice(1)
const isGroup = (chat) => ['group', 'supergroup'].includes(chat.type)
const escrowCode = (value) => String(value || '').toUpperCase()

function actorName(user, visibility) {
  if (visibility === 'group' || visibility === 'channel') return user.username ? `@${esc(user.username)}` : `Telegram user <code>${user.id}</code>`
  return 'linked account'
}

function escrowText(escrow, visibility = 'group') {
  return `🔐 <b>${esc(escrow.id)}</b>\nAsset: <b>${esc(escrow.asset)}</b>\nAmount: <b>${esc(escrow.amount)}</b>\nStatus: <b>${esc(escrow.status)}</b>\nEscrow address: <code>${esc(escrow.wallet?.address || 'waiting for wallet provider')}</code>\nBuyer: ${escrow.buyerTelegramId ? `<code>${escrow.buyerTelegramId}</code>` : 'not assigned'}\nSeller: ${escrow.sellerTelegramId ? `<code>${escrow.sellerTelegramId}</code>` : 'not assigned'}${visibility === 'group' ? '\n\nUsernames are displayed only inside this group.' : ''}`
}

async function welcome(chatId) {
  const message = await sendMessage(chatId, welcomeText(), { reply_markup: welcomeKeyboard() })
  try { await pinMessageIfGroup(chatId, message) } catch { /* pinning is optional */ }
  return message
}

async function pinMessageIfGroup(chatId, message) {
  const chat = await telegram('getChat', { chat_id: chatId })
  if (isGroup(chat)) await telegram('pinChatMessage', { chat_id: chatId, message_id: message.message_id, disable_notification: true })
}

async function reply(chatId, text, extra = {}) { return sendMessage(chatId, text, extra) }

async function handleCommand(message, user) {
  const chat = message.chat
  const text = message.text || ''
  const command = text.split(/\s+/)[0].split('@')[0].toLowerCase()
  const values = args(text)
  const send = (body, extra = {}) => reply(chat.id, body, extra)

  if (command === '/start') return welcome(chat.id)
  if (command === '/help' || command === '/menu') return send(helpText(), { reply_markup: welcomeKeyboard() })
  if (command === '/about') return send(aboutText())
  if (command === '/instructions') return send(instructionsText())
  if (command === '/terms') return send(termsText())
  if (command === '/create') {
    try {
      const escrow = createEscrow({ chat, creator: user, asset: values[0], amount: values[1] })
      return send(`✅ Escrow group assigned.\n\n${escrowText(escrow)}\n\nCreator: choose your role so the wallet provider can generate the escrow address.`, { reply_markup: roleKeyboard(escrow.id) })
    } catch (error) { return send(`⚠️ ${esc(error.message)}\n\nExample: <code>/create BTC 0.10</code>`) }
  }
  if (command === '/buyer' || command === '/seller') {
    const role = command.slice(1)
    const escrowId = escrowCode(values[0])
    if (!escrowId) return send(`Usage: <code>/${role} ESCROW_ID</code>`)
    try {
      const escrow = await assignRole({ escrowId, chatId: chat.id, userId: user.id, role })
      setMembership({ chatId: chat.id, userId: user.id, role })
      return send(`✅ You are assigned as the ${role}.\n\n${escrowText(escrow)}`, { reply_markup: actionKeyboard(escrow) })
    } catch (error) { return send(`⚠️ ${esc(error.message)}`) }
  }
  if (command === '/status') {
    try { return send(escrowText(statusFor(escrowCode(values[0]), chat.id))) } catch (error) { return send(`⚠️ ${esc(error.message)}`) }
  }
  if (command === '/release') {
    try {
      const escrow = requestRelease({ escrowId: escrowCode(values[0]), chatId: chat.id, userId: user.id })
      return send(`✅ Release requested for <b>${esc(escrow.id)}</b>. The seller must confirm the release.`, { reply_markup: actionKeyboard(escrow) })
    } catch (error) { return send(`⚠️ ${esc(error.message)}`) }
  }
  if (command === '/refund') {
    try {
      const escrow = requestRefund({ escrowId: escrowCode(values[0]), chatId: chat.id, userId: user.id })
      return send(`↩️ Refund requested for <b>${esc(escrow.id)}</b>. The seller must confirm the refund.`, { reply_markup: actionKeyboard(escrow) })
    } catch (error) { return send(`⚠️ ${esc(error.message)}`) }
  }
  if (command === '/whoami') {
    const membership = getMembership(chat.id, user.id)
    return send(`👤 <b>Your Telegram account is linked.</b>\nChat ID: <code>${user.lastChatId}</code>\nRole in this group: <b>${membership?.role || 'not selected'}</b>\nUsername visibility: only group/channel contexts.`)
  }
  if (command.startsWith('/')) return send('Unknown command. Use /help.')
}

async function handleCallback(query) {
  const message = query.message
  const data = query.data || ''
  const user = query.from
  await answerCallback(query.id, 'Processing…')
  if (data === 'about') return sendMessage(message.chat.id, aboutText())
  if (data === 'instructions') return sendMessage(message.chat.id, instructionsText())
  if (data === 'terms') return sendMessage(message.chat.id, termsText())
  if (data === 'create') return sendMessage(message.chat.id, 'Create an existing Telegram group, add this bot as an administrator, then run <code>/create ASSET AMOUNT</code> inside that group.')
  const [action, escrowId] = data.split(':')
  try {
    if (action === 'role') {
      const [, role, id] = data.split(':')
      const escrow = await assignRole({ escrowId: id, chatId: message.chat.id, userId: user.id, role })
      setMembership({ chatId: message.chat.id, userId: user.id, role })
      return editMessage(message.chat.id, message.message_id, `✅ Role selected: <b>${role}</b>.\n\n${escrowText(escrow)}`, { reply_markup: actionKeyboard(escrow) })
    }
    if (action === 'release') {
      const escrow = requestRelease({ escrowId, chatId: message.chat.id, userId: user.id })
      return editMessage(message.chat.id, message.message_id, `✅ Release requested for <b>${esc(escrow.id)}</b>. Seller confirmation is required.`, { reply_markup: actionKeyboard(escrow) })
    }
    if (action === 'refund') {
      const escrow = requestRefund({ escrowId, chatId: message.chat.id, userId: user.id })
      return editMessage(message.chat.id, message.message_id, `↩️ Refund requested for <b>${esc(escrow.id)}</b>. Seller confirmation is required.`, { reply_markup: actionKeyboard(escrow) })
    }
    if (action === 'release-confirm') {
      const escrow = await confirmRelease({ escrowId, chatId: message.chat.id, userId: user.id })
      return editMessage(message.chat.id, message.message_id, `✅ Funds released for <b>${esc(escrow.id)}</b>.`, { reply_markup: { inline_keyboard: [] } })
    }
    if (action === 'refund-confirm') {
      const escrow = await confirmRefund({ escrowId, chatId: message.chat.id, userId: user.id })
      return editMessage(message.chat.id, message.message_id, `↩️ Funds refunded for <b>${esc(escrow.id)}</b>.`, { reply_markup: { inline_keyboard: [] } })
    }
  } catch (error) { return sendMessage(message.chat.id, `⚠️ ${esc(error.message)}`) }
}

export async function handleUpdate(update) {
  if (update.callback_query) return handleCallback(update.callback_query)
  const message = update.message
  if (!message?.from || !message.chat) return
  const user = upsertUser({ telegramUser: message.from, chat: message.chat })
  if (message.text) await handleCommand(message, user)
}

export function verifyWalletSignature(body, signature) {
  if (!config.walletWebhookSecret || !signature) return false
  const expected = createHmac('sha256', config.walletWebhookSecret).update(body).digest('hex')
  const left = Buffer.from(String(signature)); const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function handleWalletEvent(payload) {
  addEvent({ type: 'wallet_event', payload })
  return payload
}
