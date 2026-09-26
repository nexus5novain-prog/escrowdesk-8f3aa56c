import { channels } from './config.mjs'

const button = (text, callback_data) => ({ text, callback_data })

export const welcomeKeyboard = () => ({ inline_keyboard: [
  [button('❓ What is escrow?', 'about'), button('ℹ️ Instructions', 'instructions')],
  [button('🤝 Terms', 'terms')],
  [button('⚡ Create escrow group', 'create')]
] })

export const roleKeyboard = (escrowId) => ({ inline_keyboard: [[
  button('🛒 I am the buyer', `role:buyer:${escrowId}`),
  button('📦 I am the seller', `role:seller:${escrowId}`)
]] })

export const actionKeyboard = (escrow) => ({ inline_keyboard: [
  ...(escrow.status === 'funded' ? [[button('✅ Release funds', `release:${escrow.id}`), button('↩️ Request refund', `refund:${escrow.id}`)]] : []),
  ...(escrow.status === 'release_requested' ? [[button('✅ Confirm release', `release-confirm:${escrow.id}`)]] : []),
  ...(escrow.status === 'refund_requested' ? [[button('✅ Confirm refund', `refund-confirm:${escrow.id}`)]] : [])
] })

export const welcomeText = () => `🔐 <b>NOVAIN ESCROWDESK</b>\n<i>Independent Telegram escrow infrastructure</i>\n\nProtect two-party transactions with a generated escrow address, clear milestones, and controlled release or refund.\n\n👤 Every Telegram user is linked privately to their Telegram ID. Usernames appear only in the escrow group and official deal channel.\n🌐 Supported assets are configured by the wallet provider.\n🛡️ Never send funds until the bot shows a valid escrow ID and address.`

export const aboutText = () => `❓ <b>What is escrow?</b>\n\nEscrow temporarily holds the buyer's funds while the seller completes the agreed transaction. The buyer and seller are identified in the escrow group, funding is tracked by the wallet provider, and funds move only through the defined release or refund flow.\n\nThe bot is the transaction interface. Official announcements and deal verification will be published in the configured channels.`

export const instructionsText = () => `ℹ️ <b>Instructions</b>\n\n1. Add the bot to an existing group as an administrator.\n2. Run <code>/create ASSET AMOUNT</code> in that group.\n3. The creator chooses <b>buyer</b> or <b>seller</b>.\n4. The bot requests a provider-generated escrow address.\n5. The other party joins and identifies with <code>/buyer ESCROW_ID</code> or <code>/seller ESCROW_ID</code>.\n6. Fund only the displayed address.\n7. Release or request a refund using the inline buttons after the status changes.\n\nTelegram bots cannot create a new group through the Bot API. The bot creates and assigns the escrow inside the existing group and can provide an invite link if it has admin permission.`

export const termsText = () => `🤝 <b>Escrow terms</b>\n\nThe escrow ID, asset, amount, parties, address, status changes, and settlement events are recorded. The bot never invents wallet addresses. Wallet custody stays with the configured provider. Verify the official bot and channel identity before funding.`

export function helpText() {
  const c = channels()
  return `📚 <b>Command guide</b>\n\n/start — permanent welcome and buttons\n/help — this guide\n/about — how escrow works\n/instructions — setup steps\n/terms — operating terms\n/create ASSET AMOUNT — create an escrow in a group\n/buyer ESCROW_ID — identify as buyer\n/seller ESCROW_ID — identify as seller\n/status ESCROW_ID — show current status\n/release ESCROW_ID — buyer requests release\n/refund ESCROW_ID — buyer requests refund\n\n<b>Official channels</b>\nDeals: ${c.deals || 'to be configured'}\nUpdates: ${c.updates || 'to be configured'}\nBot verification: ${c.bot || 'to be configured'}`
}
