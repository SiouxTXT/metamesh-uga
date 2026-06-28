/**
 * MetaMesh-UGA Agent Billing Worker
 * 
 * Handles:
 * - Monthly invoice generation for agents
 * - Usage tracking and billing
 * - Wallet top-up processing
 * - Budget monitoring and alerts
 */

export default {
  // Daily cron for billing and budget checks
  async scheduled(event, env, ctx) {
    console.log('Billing job started at:', new Date().toISOString());
    
    try {
      // Check if it's the first of the month (for monthly invoices)
      const today = new Date();
      const isFirstOfMonth = today.getDate() === 1;
      
      if (isFirstOfMonth) {
        // Generate monthly invoices
        await generateMonthlyInvoices(env);
      }
      
      // Daily budget checks
      await checkAgentBudgets(env);
      
      // Cleanup old data
      await cleanupOldData(env);
      
      console.log('Billing job completed');
      
    } catch (error) {
      console.error('Billing job failed:', error);
      
      if (env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramNotification(env, `❌ Billing job failed: ${error.message}`);
      }
    }
  },
  
  // HTTP endpoints for manual operations
  async fetch(request, env) {
    const url = new URL(request.url);
    const adminKey = request.headers.get('X-Admin-Key');
    
    // Invoice generation endpoint
    if (url.pathname === '/generate-invoices' && adminKey === env.ADMIN_KEY) {
      const result = await generateMonthlyInvoices(env);
      return jsonResponse(result);
    }
    
    // Budget check endpoint
    if (url.pathname === '/check-budgets' && adminKey === env.ADMIN_KEY) {
      const result = await checkAgentBudgets(env);
      return jsonResponse(result);
    }
    
    // Agent invoice endpoint (for specific agent)
    if (url.pathname.startsWith('/agent/') && url.pathname.endsWith('/invoice')) {
      const agentId = url.pathname.split('/')[2];
      const invoice = await generateAgentInvoice(agentId, env);
      return jsonResponse(invoice);
    }
    
    return jsonResponse({ error: 'Not found' }, 404);
  }
};

/**
 * Generate monthly invoices for all agents
 */
async function generateMonthlyInvoices(env) {
  const results = {
    generated: 0,
    failed: 0,
    total_amount: 0,
    invoices: []
  };
  
  // Get all agents with usage this month
  const agents = await env.DB.prepare(
    `SELECT DISTINCT a.* 
     FROM agents a
     JOIN agent_usage au ON a.id = au.agent_id
     WHERE au.last_called > datetime('now', 'start of month')
     AND a.plan != 'free'`
  ).all();
  
  for (const agent of agents.results || []) {
    try {
      const invoice = await generateAgentInvoice(agent.agent_id, env);
      
      if (invoice.success) {
        results.generated++;
        results.total_amount += invoice.amount;
        results.invoices.push({
          agent_id: agent.agent_id,
          invoice_number: invoice.invoice_number,
          amount: invoice.amount
        });
      } else {
        results.failed++;
      }
    } catch (error) {
      console.error(`Failed to generate invoice for ${agent.agent_id}:`, error);
      results.failed++;
    }
  }
  
  // Send summary notification
  if (results.generated > 0 && env.TELEGRAM_BOT_TOKEN) {
    await sendTelegramNotification(
      env,
      `📊 Monthly invoices generated\nCount: ${results.generated}\nTotal: $${results.total_amount.toFixed(2)}`
    );
  }
  
  return results;
}

/**
 * Generate invoice for a single agent
 */
async function generateAgentInvoice(agentId, env) {
  try {
    // Get agent info
    const agent = await env.DB.prepare(
      'SELECT * FROM agents WHERE agent_id = ?'
    ).bind(agentId).first();
    
    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }
    
    // Get usage for this month
    const usage = await env.DB.prepare(
      `SELECT 
        tool_name,
        call_count,
        total_spent_usd
      FROM agent_usage
      WHERE agent_id = ?
      AND last_called > datetime('now', 'start of month')`
    ).bind(agent.id).all();
    
    if (!usage.results || usage.results.length === 0) {
      return { success: false, error: 'No usage this month' };
    }
    
    // Calculate total
    const totalAmount = usage.results.reduce((sum, u) => sum + u.total_spent_usd, 0);
    
    // Generate invoice number
    const date = new Date();
    const invoiceNumber = `INV-${agent.id}-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    // Create period dates
    const periodStart = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
    const periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString();
    
    // Save invoice to database
    await env.DB.prepare(
      `INSERT INTO invoices 
        (agent_id, invoice_number, period_start, period_end, amount_usd, status)
        VALUES (?, ?, ?, ?, ?, 'draft')`
    ).bind(agent.id, invoiceNumber, periodStart, periodEnd, totalAmount).run();
    
    // Generate PDF (in production, this would call a PDF generation service)
    // For now, we just create a JSON representation
    const invoice = {
      invoice_number: invoiceNumber,
      date: date.toISOString(),
      agent: {
        agent_id: agent.agent_id,
        email: agent.email,
        wallet_address: agent.wallet_address
      },
      period: {
        start: periodStart,
        end: periodEnd
      },
      items: usage.results.map(u => ({
        tool: u.tool_name,
        calls: u.call_count,
        amount: u.total_spent_usd
      })),
      total: totalAmount,
      currency: 'USD'
    };
    
    // Store PDF in R2 (simulated as JSON for now)
    const pdfKey = `invoices/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${invoiceNumber}.json`;
    await env.STORAGE?.put(pdfKey, JSON.stringify(invoice, null, 2), {
      httpMetadata: { contentType: 'application/json' }
    });
    
    // Update invoice with PDF URL
    await env.DB.prepare(
      'UPDATE invoices SET pdf_url = ? WHERE invoice_number = ?'
    ).bind(pdfKey, invoiceNumber).run();
    
    // Send email to agent (if email available)
    if (agent.email) {
      await sendInvoiceEmail(env, agent.email, invoice);
    }
    
    // Reset monthly counters
    await env.DB.prepare(
      'UPDATE agents SET current_spent_usd = 0 WHERE id = ?'
    ).bind(agent.id).run();
    
    // Reset alert flags
    await env.DB.prepare(
      'UPDATE agent_rate_limits SET alert_80_sent = FALSE, alert_100_sent = FALSE WHERE agent_id = ?'
    ).bind(agent.id).run();
    
    return {
      success: true,
      invoice_number: invoiceNumber,
      amount: totalAmount,
      pdf_url: pdfKey
    };
    
  } catch (error) {
    console.error('Invoice generation error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check agent budgets and send alerts
 */
async function checkAgentBudgets(env) {
  const results = {
    alerts_sent: 0,
    agents_suspended: 0,
    alerts: []
  };
  
  // Get all agents with budget limits
  const agents = await env.DB.prepare(
    'SELECT * FROM agents WHERE budget_limit_usd > 0 AND suspended = FALSE'
  ).all();
  
  for (const agent of agents.results || []) {
    const budgetPercent = (agent.current_spent_usd / agent.budget_limit_usd) * 100;
    
    // Check if at 80% and alert not sent
    if (budgetPercent >= 80 && budgetPercent < 100) {
      const rateLimit = await env.DB.prepare(
        'SELECT alert_80_sent FROM agent_rate_limits WHERE agent_id = ?'
      ).bind(agent.id).first();
      
      if (!rateLimit || !rateLimit.alert_80_sent) {
        // Send alert
        const alertMessage = `⚠️ Budget Alert\nAgent: ${agent.agent_id.slice(0, 12)}...\nUsed: $${agent.current_spent_usd.toFixed(2)} / $${agent.budget_limit_usd} (${budgetPercent.toFixed(1)}%)`;
        
        if (agent.email) {
          await sendEmail(env, agent.email, 'MetaMesh Budget Alert', alertMessage);
        }
        
        // Mark alert as sent
        await env.DB.prepare(
          `INSERT INTO agent_rate_limits (agent_id, alert_80_sent) 
           VALUES (?, TRUE)
           ON CONFLICT(agent_id) DO UPDATE SET alert_80_sent = TRUE`
        ).bind(agent.id).run();
        
        results.alerts_sent++;
        results.alerts.push({
          agent_id: agent.agent_id,
          level: '80%',
          message: alertMessage
        });
      }
    }
    
    // Check if at 100% and suspend
    if (budgetPercent >= 100) {
      // Suspend agent
      await env.DB.prepare(
        'UPDATE agents SET suspended = TRUE, suspended_reason = ? WHERE id = ?'
      ).bind('Budget limit exceeded', agent.id).run();
      
      // Send notification
      const suspendMessage = `🚫 Agent Suspended\nAgent: ${agent.agent_id}\nReason: Budget limit exceeded ($${agent.current_spent_usd.toFixed(2)} / $${agent.budget_limit_usd})`;
      
      if (agent.email) {
        await sendEmail(env, agent.email, 'MetaMesh Agent Suspended', suspendMessage);
      }
      
      if (env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramNotification(env, suspendMessage);
      }
      
      results.agents_suspended++;
      results.alerts.push({
        agent_id: agent.agent_id,
        level: '100%',
        suspended: true
      });
    }
  }
  
  return results;
}

/**
 * Cleanup old data
 */
async function cleanupOldData(env) {
  const results = {};
  
  // Cleanup old usage logs (keep 90 days)
  const usageCleanup = await env.DB.prepare(
    "DELETE FROM usage_log WHERE called_at < datetime('now', '-90 days')"
  ).run();
  results.usage_deleted = usageCleanup.meta?.changes || 0;
  
  // Cleanup old nonces (keep 24 hours)
  const nonceCleanup = await env.DB.prepare(
    "DELETE FROM used_nonces WHERE expires_at < datetime('now')"
  ).run();
  results.nonces_deleted = nonceCleanup.meta?.changes || 0;
  
  // Cleanup old transactions (keep 1 year)
  const txCleanup = await env.DB.prepare(
    "DELETE FROM transactions WHERE created_at < datetime('now', '-1 year')"
  ).run();
  results.transactions_deleted = txCleanup.meta?.changes || 0;
  
  // Archive old invoices (keep 2 years, archive older)
  // In production, move to cold storage
  
  console.log('Cleanup results:', results);
  return results;
}

/**
 * Send invoice email
 */
async function sendInvoiceEmail(env, email, invoice) {
  // In production, use Cloudflare Email Workers or external service
  // For now, just log
  console.log(`Would send invoice email to ${email}:`, invoice.invoice_number);
}

/**
 * Send email
 */
async function sendEmail(env, to, subject, body) {
  // In production, integrate with email service
  console.log(`Would send email to ${to}: ${subject}`);
}

/**
 * Send Telegram notification
 */
async function sendTelegramNotification(env, message) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return;
  }
  
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (error) {
    console.error('Telegram notification failed:', error);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}
