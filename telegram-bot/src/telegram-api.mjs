import { config, requireBotConfig } from './config.mjs'

function apiUrl(method) {
  return `https://api.telegram.org/bot${config.botToken}/${method}`
}

export async function telegram(method, payload = {}) {
  requireBotConfig()
  const response = await fetch(apiUrl(method), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.ok === false) {
    throw new Error(`Telegram ${method} failed: ${response.status} ${body.description || 'unknown error'}`)
  }
  return body.result
}

export const sendMessage = (chatId, text, extra = {}) =>
  telegram('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra })

export const editMessage = (chatId, messageId, text, extra = {}) =>
  telegram('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', ...extra })

export const answerCallback = (callbackQueryId, text, extra = {}) =>
  telegram('answerCallbackQuery', { callback_query_id: callbackQueryId, text, ...extra })

export const pinMessage = (chatId, messageId) =>
  telegram('pinChatMessage', { chat_id: chatId, message_id: messageId, disable_notification: true })

export const exportInviteLink = (chatId) => telegram('exportChatInviteLink', { chat_id: chatId })

export const getChatMember = (chatId, userId) =>
  telegram('getChatMember', { chat_id: chatId, user_id: userId })
