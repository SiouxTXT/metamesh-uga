#!/usr/bin/env node

/**
 * MetaMesh-UGA Self-Healing System
 * Monitors system health and attempts automatic recovery
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;

class SelfHealingMonitor {
  constructor() {
    this.isRunning = false;
    this.retryCount = {};
    this.lastReport = null;
  }

  async start() {
    console.log('🔧 MetaMesh-UGA Self-Healing Monitor');
    console.log('   Starting continuous health monitoring...\n');
    
    this.isRunning = true;
    
    // Run immediately
    await this.healthCheckCycle();
    
    // Then schedule
    this.interval = setInterval(() => {
      this.healthCheckCycle();
    }, HEALTH_CHECK_INTERVAL);
    
    // Keep process alive
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  stop() {
    console.log('\n🛑 Stopping self-healing monitor...');
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
    }
    process.exit(0);
  }

  async healthCheckCycle() {
    if (!this.isRunning) return;
    
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] 🔄 Health Check Cycle`);
    
    const issues = [];
    
    try {
      // Check Gateway
      const gatewayHealth = await this.checkService('Gateway', 'https://api.metamesh-uga.dev/health');
      if (!gatewayHealth.ok) issues.push(gatewayHealth);
      
      // Check Database via API
      const dbHealth = await this.checkDatabase();
      if (!dbHealth.ok) issues.push(dbHealth);
      
      // Check Workers
      const workerHealth = await this.checkWorkers();
      issues.push(...workerHealth.filter(h => !h.ok));
      
      // Check Pages
      const pagesHealth = await this.checkPages();
      issues.push(...pagesHealth.filter(h => !h.ok));
      
      // Handle issues
      if (issues.length === 0) {
        console.log('✅ All systems healthy');
        this.lastReport = { timestamp, status: 'healthy', issues: [] };
      } else {
        console.log(`⚠️ Found ${issues.length} issue(s)`);
        await this.handleIssues(issues);
      }
      
      // Save report
      await this.saveReport();
      
    } catch (error) {
      console.error('❌ Health check cycle failed:', error.message);
    }
  }

  async checkService(name, url) {
    try {
      const response = await fetch(url, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        return { name, ok: true, status: response.status };
      } else {
        return { 
          name, 
          ok: false, 
          status: response.status,
          error: `HTTP ${response.status}` 
        };
      }
    } catch (e) {
      return { 
        name, 
        ok: false, 
        error: e.message 
      };
    }
  }

  async checkDatabase() {
    try {
      // Query via API endpoint
      const response = await fetch('https://api.metamesh-uga.dev/v1/tools?limit=1');
      if (response.ok) {
        return { name: 'Database', ok: true, status: 'connected' };
      } else {
        return { name: 'Database', ok: false, error: 'Query failed' };
      }
    } catch (e) {
      return { name: 'Database', ok: false, error: e.message };
    }
  }

  async checkWorkers() {
    const workers = ['discovery', 'alerts', 'agent-billing', 'gateway'];
    const results = [];
    
    for (const worker of workers) {
      try {
        // Check via wrangler
        execSync(`wrangler worker get ${worker}`, { stdio: 'pipe' });
        results.push({ name: `Worker:${worker}`, ok: true });
      } catch (e) {
        results.push({ 
          name: `Worker:${worker}`, 
          ok: false, 
          error: 'Not found or error' 
        });
      }
    }
    
    return results;
  }

  async checkPages() {
    const pages = [
      { name: 'Landing', url: 'https://metamesh-uga.dev' },
      { name: 'Dashboard', url: 'https://dashboard.metamesh-uga.dev' }
    ];
    
    const results = [];
    for (const page of pages) {
      const check = await this.checkService(page.name, page.url);
      results.push(check);
    }
    
    return results;
  }

  async handleIssues(issues) {
    for (const issue of issues) {
      const retryKey = issue.name;
      const retries = this.retryCount[retryKey] || 0;
      
      console.log(`🔧 Attempting to heal: ${issue.name} (retry ${retries + 1}/${MAX_RETRIES})`);
      
      if (retries >= MAX_RETRIES) {
        console.log(`❌ Max retries reached for ${issue.name}. Manual intervention required.`);
        await this.sendAlert(`CRITICAL: ${issue.name} failed after ${MAX_RETRIES} recovery attempts`);
        continue;
      }
      
      try {
        const healed = await this.attemptHeal(issue);
        if (healed) {
          console.log(`✅ Healed: ${issue.name}`);
          this.retryCount[retryKey] = 0;
          await this.sendAlert(`RECOVERED: ${issue.name} is now healthy`);
        } else {
          this.retryCount[retryKey] = retries + 1;
        }
      } catch (e) {
        console.error(`❌ Heal failed for ${issue.name}:`, e.message);
        this.retryCount[retryKey] = retries + 1;
      }
    }
  }

  async attemptHeal(issue) {
    const name = issue.name;
    
    if (name.startsWith('Worker:')) {
      const workerName = name.split(':')[1];
      return await this.healWorker(workerName);
    } else if (name === 'Database') {
      return await this.healDatabase();
    } else if (name === 'Gateway') {
      return await this.healGateway();
    } else if (name === 'Landing' || name === 'Dashboard') {
      return await this.healPages(name.toLowerCase());
    }
    
    return false;
  }

  async healWorker(workerName) {
    console.log(`  → Redeploying worker: ${workerName}`);
    
    try {
      execSync('wrangler deploy --env production', {
        cwd: `./packages/${workerName}`,
        stdio: 'pipe'
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  async healDatabase() {
    console.log(`  → Re-running database migrations...`);
    
    try {
      execSync(
        'wrangler d1 execute metamesh-catalog --file=./shared/migrations/001_init.sql',
        { stdio: 'pipe' }
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  async healGateway() {
    console.log(`  → Redeploying gateway...`);
    return await this.healWorker('gateway');
  }

  async healPages(project) {
    console.log(`  → Redeploying pages: ${project}`);
    
    const pagesMap = {
      'landing': 'metamesh-landing',
      'dashboard': 'metamesh-dashboard'
    };
    
    try {
      const projectName = pagesMap[project];
      const cwd = `./packages/${project}`;
      
      execSync('npm run build', { cwd, stdio: 'pipe' });
      execSync(`wrangler pages deploy ./dist --project-name=${projectName}`, { 
        cwd, 
        stdio: 'pipe' 
      });
      
      return true;
    } catch (e) {
      return false;
    }
  }

  async sendAlert(message) {
    // Try Telegram
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (botToken && chatId) {
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🚨 MetaMesh Alert\n\n${message}\n\nTime: ${new Date().toISOString()}`
          })
        });
        console.log('  📨 Alert sent via Telegram');
        return;
      } catch (e) {
        console.log('  ⚠️ Telegram alert failed');
      }
    }
    
    // Try Discord
    const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
    if (discordWebhook) {
      try {
        await fetch(discordWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🚨 MetaMesh Alert: ${message}`
          })
        });
        console.log('  📨 Alert sent via Discord');
        return;
      } catch (e) {
        console.log('  ⚠️ Discord alert failed');
      }
    }
    
    // Fallback to console
    console.log('  📢 ALERT:', message);
  }

  async saveReport() {
    const reportDir = path.join(process.cwd(), 'health-reports');
    await fs.mkdir(reportDir, { recursive: true });
    
    const reportPath = path.join(reportDir, `health-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(this.lastReport, null, 2));
  }
}

// Run if executed directly
if (require.main === module) {
  const monitor = new SelfHealingMonitor();
  monitor.start();
}

module.exports = { SelfHealingMonitor };
