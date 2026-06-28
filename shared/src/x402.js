/**
 * x402 Protocol Module (HTTP 402 Payment Protocol)
 * MetaMesh-UGA - Shared Library
 * 
 * Implements EIP-712 typed data signing for micropayments
 * Supports USDC on Base network
 */

import { verifyTypedData, recoverAddress, parseSignature } from 'viem';
import { base } from 'viem/chains';

// EIP-712 Domain for MetaMesh x402
const X402_DOMAIN = {
  name: 'MetaMesh x402',
  version: '1',
  chainId: 8453, // Base mainnet
};

// EIP-712 Types
const X402_TYPES = {
  Payment: [
    { name: 'payer', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'currency', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
    { name: 'toolName', type: 'string' }
  ]
};

// USDC contract address on Base
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

/**
 * Generate payment quote for a tool
 * @param {string} toolName
 * @param {string} agentId
 * @param {object} env
 * @returns {Promise<object>}
 */
export async function generatePaymentQuote(toolName, agentId, env) {
  // Get tool pricing
  const pricing = await env.DB.prepare(
    'SELECT * FROM tool_pricing WHERE tool_name = ? AND x402_enabled = TRUE'
  ).bind(toolName).first();
  
  if (!pricing) {
    return {
      error: 'Tool not available for x402 payment',
      x402_enabled: false
    };
  }
  
  // Get agent info
  const agent = await env.DB.prepare(
    'SELECT * FROM agents WHERE agent_id = ?'
  ).bind(agentId).first();
  
  if (!agent) {
    return {
      error: 'Agent not found',
      code: 'AGENT_NOT_FOUND'
    };
  }
  
  // Check if agent is suspended
  if (agent.suspended) {
    return {
      error: 'Agent suspended',
      code: 'AGENT_SUSPENDED',
      reason: agent.suspended_reason
    };
  }
  
  // Generate nonce
  const nonce = Date.now() + Math.floor(Math.random() * 1000000);
  
  // Set expiration (15 minutes)
  const expiresAt = Math.floor(Date.now() / 1000) + 900;
  
  // Calculate amount in wei (6 decimals for USDC)
  const amount = BigInt(Math.floor(pricing.price_per_call_usdc * 1e6));
  
  // Create payment object
  const payment = {
    payer: agent.wallet_address,
    amount: amount.toString(),
    currency: USDC_BASE,
    nonce: nonce.toString(),
    expiresAt: expiresAt.toString(),
    toolName
  };
  
  // Calculate discount for bulk usage
  let finalAmount = amount;
  let discountApplied = false;
  
  if (pricing.discount_bulk) {
    const usage = await env.DB.prepare(
      'SELECT call_count FROM agent_usage WHERE agent_id = ? AND tool_name = ?'
    ).bind(agent.id, toolName).first();
    
    if (usage && usage.call_count >= pricing.min_call_volume) {
      const discountAmount = BigInt(Math.floor(pricing.bulk_price * 1e6));
      finalAmount = discountAmount;
      discountApplied = true;
    }
  }
  
  payment.amount = finalAmount.toString();
  
  return {
    x402_enabled: true,
    payment,
    domain: X402_DOMAIN,
    types: X402_TYPES,
    primaryType: 'Payment',
    pricing: {
      base_price: pricing.price_per_call_usdc,
      final_price: Number(finalAmount) / 1e6,
      discount_applied: discountApplied,
      currency: 'USDC',
      chain: 'base'
    },
    agent: {
      agent_id: agent.agent_id,
      wallet_address: agent.wallet_address,
      budget_limit: agent.budget_limit_usd,
      current_spent: agent.current_spent_usd
    }
  };
}

/**
 * Verify x402 payment
 * @param {object} payment
 * @param {string} signature
 * @param {object} env
 * @returns {Promise<object>}
 */
export async function verifyX402Payment(payment, signature, env) {
  try {
    // 1. Check if nonce was already used (anti-replay)
    const used = await env.DB.prepare(
      'SELECT * FROM used_nonces WHERE nonce = ?'
    ).bind(payment.nonce).first();
    
    if (used) {
      return {
        verified: false,
        error: 'Payment nonce already used',
        code: 'NONCE_REUSED'
      };
    }
    
    // 2. Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (now > parseInt(payment.expiresAt)) {
      return {
        verified: false,
        error: 'Payment expired',
        code: 'PAYMENT_EXPIRED',
        expired_at: payment.expiresAt,
        current_time: now
      };
    }
    
    // 3. Verify EIP-712 signature
    const domain = {
      ...X402_DOMAIN,
      verifyingContract: env.X402_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000'
    };
    
    let recoveredAddress;
    try {
      recoveredAddress = await recoverAddress({
        domain,
        types: X402_TYPES,
        primaryType: 'Payment',
        message: payment,
        signature
      });
    } catch (e) {
      return {
        verified: false,
        error: 'Invalid signature',
        code: 'INVALID_SIGNATURE',
        details: e.message
      };
    }
    
    // 4. Verify payer matches recovered address
    if (recoveredAddress.toLowerCase() !== payment.payer.toLowerCase()) {
      return {
        verified: false,
        error: 'Signature does not match payer',
        code: 'SIGNATURE_MISMATCH',
        recovered: recoveredAddress,
        expected: payment.payer
      };
    }
    
    // 5. Get agent and verify wallet
    const agent = await env.DB.prepare(
      'SELECT * FROM agents WHERE wallet_address = ?'
    ).bind(payment.payer.toLowerCase()).first();
    
    if (!agent) {
      return {
        verified: false,
        error: 'Agent not found for wallet address',
        code: 'AGENT_NOT_FOUND'
      };
    }
    
    if (agent.suspended) {
      return {
        verified: false,
        error: 'Agent suspended',
        code: 'AGENT_SUSPENDED'
      };
    }
    
    // 6. Check agent balance
    const wallet = await env.DB.prepare(
      'SELECT * FROM agent_wallets WHERE agent_id = ? AND chain = ? AND currency = ?'
    ).bind(agent.id, 'base', 'USDC').first();
    
    const balance = wallet ? parseFloat(wallet.balance) : 0;
    const amount = Number(payment.amount) / 1e6; // Convert from wei
    
    if (balance < amount) {
      return {
        verified: false,
        error: 'Insufficient balance',
        code: 'INSUFFICIENT_BALANCE',
        balance,
        required: amount
      };
    }
    
    // 7. Check budget limit
    if (agent.budget_limit_usd > 0) {
      const newSpent = agent.current_spent_usd + amount;
      if (newSpent > agent.budget_limit_usd) {
        // Suspend agent
        await env.DB.prepare(
          'UPDATE agents SET suspended = TRUE, suspended_reason = ? WHERE id = ?'
        ).bind('Budget limit exceeded', agent.id).run();
        
        return {
          verified: false,
          error: 'Budget limit exceeded. Agent suspended.',
          code: 'BUDGET_EXCEEDED',
          budget_limit: agent.budget_limit_usd,
          current_spent: agent.current_spent_usd,
          requested_amount: amount
        };
      }
    }
    
    // 8. Store nonce to prevent replay
    const expiresAt = new Date(parseInt(payment.expiresAt) * 1000).toISOString();
    await env.DB.prepare(
      'INSERT INTO used_nonces (nonce, agent_id, expires_at) VALUES (?, ?, ?)'
    ).bind(payment.nonce, agent.agent_id, expiresAt).run();
    
    // 9. Deduct from wallet (in a real implementation, this would be an on-chain transaction)
    // For now, we simulate the deduction
    await env.DB.prepare(
      'UPDATE agent_wallets SET balance = balance - ? WHERE agent_id = ? AND chain = ? AND currency = ?'
    ).bind(amount, agent.id, 'base', 'USDC').run();
    
    // 10. Update agent spending
    await env.DB.prepare(
      'UPDATE agents SET current_spent_usd = current_spent_usd + ?, total_spent_usd = total_spent_usd + ? WHERE id = ?'
    ).bind(amount, amount, agent.id).run();
    
    // 11. Record transaction
    await env.DB.prepare(
      `INSERT INTO transactions (agent_id, type, amount, currency, chain, status, metadata) 
       VALUES (?, 'payment', ?, 'USDC', 'base', 'completed', ?)`
    ).bind(agent.id, amount, JSON.stringify({
      tool_name: payment.toolName,
      nonce: payment.nonce,
      signature: signature.slice(0, 20) + '...'
    })).run();
    
    return {
      verified: true,
      agent: {
        id: agent.id,
        agent_id: agent.agent_id,
        wallet_address: agent.wallet_address
      },
      payment: {
        amount,
        currency: 'USDC',
        chain: 'base',
        tool_name: payment.toolName
      }
    };
    
  } catch (error) {
    console.error('x402 verification error:', error);
    return {
      verified: false,
      error: error.message,
      code: 'VERIFICATION_ERROR'
    };
  }
}

/**
 * Top up agent wallet
 * @param {string} agentId
 * @param {number} amount
 * @param {string} paymentMethod - 'stripe' or 'crypto'
 * @param {string} paymentIntentId - Stripe payment intent ID
 * @param {object} env
 * @returns {Promise<object>}
 */
export async function topupAgentWallet(agentId, amount, paymentMethod, paymentIntentId, env) {
  try {
    // Get agent
    const agent = await env.DB.prepare(
      'SELECT * FROM agents WHERE agent_id = ?'
    ).bind(agentId).first();
    
    if (!agent) {
      return {
        success: false,
        error: 'Agent not found'
      };
    }
    
    // Verify payment if using Stripe
    if (paymentMethod === 'stripe') {
      // In production, verify the payment intent with Stripe API
      // For now, we assume it's valid if provided
      if (!paymentIntentId) {
        return {
          success: false,
          error: 'Stripe payment intent ID required'
        };
      }
    }
    
    // Update wallet balance
    const wallet = await env.DB.prepare(
      'SELECT * FROM agent_wallets WHERE agent_id = ? AND chain = ? AND currency = ?'
    ).bind(agent.id, 'base', 'USDC').first();
    
    if (wallet) {
      await env.DB.prepare(
        'UPDATE agent_wallets SET balance = balance + ?, total_deposited = total_deposited + ? WHERE id = ?'
      ).bind(amount, amount, wallet.id).run();
    } else {
      await env.DB.prepare(
        'INSERT INTO agent_wallets (agent_id, chain, currency, balance, total_deposited) VALUES (?, ?, ?, ?, ?)'
      ).bind(agent.id, 'base', 'USDC', amount, amount).run();
    }
    
    // Record transaction
    await env.DB.prepare(
      `INSERT INTO transactions (agent_id, type, amount, currency, chain, status, stripe_payment_intent_id) 
       VALUES (?, 'topup', ?, 'USDC', 'base', 'completed', ?)`
    ).bind(agent.id, amount, paymentIntentId).run();
    
    // Log analytics
    await env.ANALYTICS.writeDataPoint({
      blobs: [agentId, 'topup', 'success'],
      doubles: [amount],
      indexes: ['agent_wallet']
    });
    
    // Get new balance
    const newWallet = await env.DB.prepare(
      'SELECT balance FROM agent_wallets WHERE agent_id = ? AND chain = ? AND currency = ?'
    ).bind(agent.id, 'base', 'USDC').first();
    
    // Unsuspend agent if was suspended due to budget
    if (agent.suspended && agent.suspended_reason === 'Budget limit exceeded') {
      const totalBalance = await getAgentTotalBalance(agent.id, env);
      if (totalBalance > 0) {
        await env.DB.prepare(
          'UPDATE agents SET suspended = FALSE, suspended_reason = NULL WHERE id = ?'
        ).bind(agent.id).run();
      }
    }
    
    return {
      success: true,
      agent_id: agentId,
      new_balance: newWallet?.balance || amount,
      topup_amount: amount,
      currency: 'USDC',
      chain: 'base'
    };
    
  } catch (error) {
    console.error('Topup error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get agent total balance across all chains/currencies
 * @param {number} agentId
 * @param {object} env
 * @returns {Promise<number>}
 */
async function getAgentTotalBalance(agentId, env) {
  const wallets = await env.DB.prepare(
    'SELECT SUM(balance) as total FROM agent_wallets WHERE agent_id = ?'
  ).bind(agentId).first();
  
  return wallets?.total || 0;
}

/**
 * Get agent wallet info
 * @param {string} agentId
 * @param {object} env
 * @returns {Promise<object>}
 */
export async function getAgentWalletInfo(agentId, env) {
  const agent = await env.DB.prepare(
    'SELECT * FROM agents WHERE agent_id = ?'
  ).bind(agentId).first();
  
  if (!agent) {
    return { error: 'Agent not found' };
  }
  
  const wallets = await env.DB.prepare(
    'SELECT * FROM agent_wallets WHERE agent_id = ?'
  ).bind(agent.id).all();
  
  const transactions = await env.DB.prepare(
    `SELECT * FROM transactions 
     WHERE agent_id = ? 
     AND created_at > datetime('now', '-30 days')
     ORDER BY created_at DESC
     LIMIT 50`
  ).bind(agent.id).all();
  
  return {
    agent_id: agent.agent_id,
    wallet_address: agent.wallet_address,
    plan: agent.plan,
    budget_limit: agent.budget_limit_usd,
    current_spent: agent.current_spent_usd,
    total_spent: agent.total_spent_usd,
    suspended: agent.suspended,
    wallets: wallets.results || [],
    recent_transactions: transactions.results || []
  };
}

/**
 * Cleanup expired nonces (call this from cron job)
 * @param {object} env
 * @returns {Promise<object>}
 */
export async function cleanupExpiredNonces(env) {
  try {
    const result = await env.DB.prepare(
      "DELETE FROM used_nonces WHERE expires_at < datetime('now')"
    ).run();
    
    return {
      success: true,
      deleted: result.meta?.changes || 0
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
