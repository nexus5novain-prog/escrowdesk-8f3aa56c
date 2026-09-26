import { randomBytes } from 'node:crypto'
import { addEscrow, addEvent, getEscrow, getMembership, updateEscrow } from './store.mjs'
import { createWalletProvider } from './wallet-provider.mjs'
import { isSupportedAsset } from './config.mjs'

const wallet = createWalletProvider()
const id = () => `ED-${randomBytes(4).toString('hex').toUpperCase()}`

export function createEscrow({ chat, creator, asset, amount }) {
  if (!['group', 'supergroup'].includes(chat.type)) throw new Error('Run /create inside the escrow group where both parties will transact.')
  if (!isSupportedAsset(asset)) throw new Error(`Asset ${asset} is not enabled by the wallet provider.`)
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new Error('Amount must be greater than zero.')
  const escrow = addEscrow({
    id: id(), chatId: chat.id, chatTitle: chat.title || 'Escrow group', asset: String(asset).toUpperCase(), amount: String(amount),
    creatorTelegramId: creator.id, buyerTelegramId: null, sellerTelegramId: null, wallet: null,
    status: 'awaiting_role', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  })
  addEvent({ type: 'escrow_created', escrowId: escrow.id, chatId: chat.id, actorTelegramId: creator.id })
  return escrow
}

export async function assignRole({ escrowId, chatId, userId, role }) {
  const escrow = getEscrow(escrowId)
  if (!escrow || String(escrow.chatId) !== String(chatId)) throw new Error('Escrow ID was not found in this group.')
  if (!['buyer', 'seller'].includes(role)) throw new Error('Role must be buyer or seller.')
  const field = `${role}TelegramId`
  if (escrow[field] && String(escrow[field]) !== String(userId)) throw new Error(`A ${role} is already assigned to this escrow.`)
  const updated = updateEscrow(escrowId, { [field]: userId, status: 'awaiting_funding' })
  if (!updated.wallet) {
    const generated = await wallet.createEscrowAddress({ escrowId, asset: updated.asset, amount: updated.amount, creatorRole: role })
    updateEscrow(escrowId, { wallet: { id: generated.walletId, address: generated.address, network: generated.network || null, asset: updated.asset } })
  }
  const result = getEscrow(escrowId)
  addEvent({ type: 'role_assigned', escrowId, role, actorTelegramId: userId })
  return result
}

export function ensureParty(escrowId, chatId, userId, role) {
  const escrow = getEscrow(escrowId)
  if (!escrow || String(escrow.chatId) !== String(chatId)) throw new Error('Escrow ID was not found in this group.')
  if (String(escrow[`${role}TelegramId`]) !== String(userId)) throw new Error(`Only the assigned ${role} can use this action.`)
  return escrow
}

export function statusFor(escrowId, chatId) {
  const escrow = getEscrow(escrowId)
  if (!escrow || String(escrow.chatId) !== String(chatId)) throw new Error('Escrow ID was not found in this group.')
  return escrow
}

export function requestRelease({ escrowId, chatId, userId }) {
  const escrow = ensureParty(escrowId, chatId, userId, 'buyer')
  if (escrow.status !== 'funded') throw new Error(`Release is available only after funding. Current status: ${escrow.status}.`)
  return updateEscrow(escrowId, { status: 'release_requested', releaseRequestedBy: userId })
}

export async function confirmRelease({ escrowId, chatId, userId }) {
  const escrow = ensureParty(escrowId, chatId, userId, 'seller')
  if (escrow.status !== 'release_requested') throw new Error('There is no pending release request.')
  await wallet.release({ escrowId, asset: escrow.asset, amount: escrow.amount, buyerTelegramId: escrow.buyerTelegramId, sellerTelegramId: escrow.sellerTelegramId })
  const result = updateEscrow(escrowId, { status: 'released', releasedAt: new Date().toISOString() })
  addEvent({ type: 'escrow_released', escrowId, actorTelegramId: userId })
  return result
}

export function requestRefund({ escrowId, chatId, userId }) {
  const escrow = ensureParty(escrowId, chatId, userId, 'buyer')
  if (!['funded', 'release_requested'].includes(escrow.status)) throw new Error(`Refund is not available from ${escrow.status}.`)
  return updateEscrow(escrowId, { status: 'refund_requested', refundRequestedBy: userId })
}

export async function confirmRefund({ escrowId, chatId, userId }) {
  const escrow = ensureParty(escrowId, chatId, userId, 'seller')
  if (escrow.status !== 'refund_requested') throw new Error('There is no pending refund request.')
  await wallet.refund({ escrowId, asset: escrow.asset, amount: escrow.amount, buyerTelegramId: escrow.buyerTelegramId, sellerTelegramId: escrow.sellerTelegramId })
  const result = updateEscrow(escrowId, { status: 'refunded', refundedAt: new Date().toISOString() })
  addEvent({ type: 'escrow_refunded', escrowId, actorTelegramId: userId })
  return result
}

export function applyFundingEvent({ escrowId, status, txid }) {
  const escrow = getEscrow(escrowId)
  if (!escrow) throw new Error('Escrow ID was not found.')
  const next = status === 'funded' ? 'funded' : escrow.status
  return updateEscrow(escrowId, { status: next, fundingTxid: txid || null, fundedAt: next === 'funded' ? new Date().toISOString() : escrow.fundedAt })
}
