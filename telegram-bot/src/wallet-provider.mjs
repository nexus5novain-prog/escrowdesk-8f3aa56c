import { config } from './config.mjs'

async function walletRequest(path, body) {
  if (!config.walletServiceUrl || !config.walletServiceApiKey) {
    throw new Error('Wallet provider is not configured. No address was generated.')
  }
  const response = await fetch(`${config.walletServiceUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.walletServiceApiKey}`
    },
    body: JSON.stringify(body)
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`Wallet provider failed: ${response.status} ${result.message || 'request rejected'}`)
  return result
}

export function createWalletProvider() {
  return {
    createEscrowAddress: (payload) => walletRequest('/v1/escrow/wallets', payload),
    release: (payload) => walletRequest('/v1/escrow/release', payload),
    refund: (payload) => walletRequest('/v1/escrow/refund', payload)
  }
}
