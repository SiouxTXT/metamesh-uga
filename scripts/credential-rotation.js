#!/usr/bin/env node

/**
 * MetaMesh-UGA Credential Rotation System
 * Automatically rotates sensitive credentials every 90 days
 */

const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const ROTATION_INTERVAL_DAYS = 90;

class CredentialRotator {
  constructor() {
    this.rotationFile = path.join(process.cwd(), '.credentials', 'last-rotation.json');
  }

  async shouldRotate() {
    try {
      const data = await fs.readFile(this.rotationFile, 'utf8');
      const { lastRotation } = JSON.parse(data);
      const daysSince = (Date.now() - lastRotation) / (1000 * 60 * 60 * 24);
      
      console.log(`Last rotation: ${daysSince.toFixed(1)} days ago`);
      return daysSince >= ROTATION_INTERVAL_DAYS;
    } catch (e) {
      console.log('No previous rotation found, will rotate');
      return true;
    }
  }

  async run() {
    console.log('\n🔐 MetaMesh-UGA Credential Rotation System');
    console.log('='.repeat(50));
    
    if (!await this.shouldRotate()) {
      console.log('✅ Credentials are up to date (rotation not needed yet)');
      return;
    }
    
    console.log('🔄 Starting credential rotation...\n');
    
    const rotations = [];
    
    // Rotate JWT_SECRET
    const newJwt = this.generateJWTSecret();
    await this.rotateSecret('JWT_SECRET', newJwt);
    rotations.push('JWT_SECRET');
    
    // Rotate ADMIN_KEY
    const newAdmin = 'admin_' + crypto.randomUUID().replace(/-/g, '');
    await this.rotateSecret('ADMIN_KEY', newAdmin);
    rotations.push('ADMIN_KEY');
    
    // Rotate API keys
    const newApiKey = 'sk_' + crypto.randomBytes(32).toString('base64url');
    await this.rotateSecret('API_KEY', newApiKey);
    rotations.push('API_KEY');
    
    // Update rotation timestamp
    await fs.writeFile(this.rotationFile, JSON.stringify({
      lastRotation: Date.now(),
      rotations,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log('\n✅ Credential rotation complete!');
    console.log(`Rotated: ${rotations.join(', ')}`);
    console.log(`Next rotation: ${new Date(Date.now() + ROTATION_INTERVAL_DAYS * 24 * 60 * 60 * 1000).toISOString()}`);
    
    // Send notification
    await this.notifyRotation(rotations);
  }

  generateJWTSecret() {
    return crypto.randomBytes(64).toString('hex');
  }

  async rotateSecret(name, newValue) {
    console.log(`  → Rotating ${name}...`);
    
    try {
      // Update in wrangler
      execSync(`echo "${newValue}" | wrangler secret put ${name}`, {
        stdio: 'pipe'
      });
      
      // Update in .env
      const envPath = path.join(process.cwd(), '.env');
      let envContent = '';
      try {
        envContent = await fs.readFile(envPath, 'utf8');
      } catch (e) {
        // File doesn't exist
      }
      
      const regex = new RegExp(`^${name}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${name}=${newValue}`);
      } else {
        envContent += `\n${name}=${newValue}`;
      }
      
      await fs.writeFile(envPath, envContent);
      
      console.log(`  ✅ ${name} rotated successfully`);
    } catch (e) {
      console.error(`  ❌ Failed to rotate ${name}:`, e.message);
      throw e;
    }
  }

  async notifyRotation(rotations) {
    const message = `🔐 Credentials Rotated\n\nRotated: ${rotations.join(', ')}\nDate: ${new Date().toISOString()}`;
    
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
            text: message
          })
        });
      } catch (e) {
        // Silent fail
      }
    }
  }
}

// Run if executed directly
if (require.main === module) {
  const rotator = new CredentialRotator();
  rotator.run().catch(e => {
    console.error('Rotation failed:', e.message);
    process.exit(1);
  });
}

module.exports = { CredentialRotator };
