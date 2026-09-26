import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

const file = resolve(process.env.BOT_DATA_FILE || new URL('../data/store.json', import.meta.url).pathname)
const initial = { users: {}, memberships: {}, escrows: {}, events: [] }

function load() {
  mkdirSync(dirname(file), { recursive: true })
  if (!existsSync(file)) return structuredClone(initial)
  try { return { ...structuredClone(initial), ...JSON.parse(readFileSync(file, 'utf8')) } } catch { return structuredClone(initial) }
}

const state = load()
const save = () => writeFileSync(file, JSON.stringify(state, null, 2))
const key = (value) => String(value)

export function upsertUser({ telegramUser, chat }) {
  const id = key(telegramUser.id)
  const current = state.users[id] || { id: randomUUID(), telegramUserId: telegramUser.id, createdAt: new Date().toISOString() }
  Object.assign(current, {
    firstName: telegramUser.first_name || '',
    lastName: telegramUser.last_name || '',
    username: telegramUser.username || null,
    lastChatId: chat.id,
    lastChatType: chat.type,
    updatedAt: new Date().toISOString()
  })
  state.users[id] = current
  save()
  return current
}

export function setMembership({ chatId, userId, role }) {
  const id = `${chatId}:${userId}`
  state.memberships[id] = { chatId, userId, role, updatedAt: new Date().toISOString() }
  save()
  return state.memberships[id]
}

export function getMembership(chatId, userId) { return state.memberships[`${chatId}:${userId}`] || null }
export function getUser(telegramUserId) { return state.users[key(telegramUserId)] || null }
export function addEscrow(escrow) { state.escrows[escrow.id] = escrow; save(); return escrow }
export function updateEscrow(id, patch) {
  const current = state.escrows[id]
  if (!current) return null
  Object.assign(current, patch, { updatedAt: new Date().toISOString() })
  save()
  return current
}
export function getEscrow(id) { return state.escrows[id] || null }
export function listEscrowsByChat(chatId) { return Object.values(state.escrows).filter((row) => String(row.chatId) === String(chatId)) }
export function addEvent(event) { state.events.push({ id: randomUUID(), ...event, createdAt: new Date().toISOString() }); save() }
export function snapshot() { return state }
