#!/usr/bin/env node

/**
 * MetaMesh-UGA Database Backup Script
 * Exports D1 database to R2 for disaster recovery
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const BACKUP_BUCKET = 'metamesh-wasm';
const BACKUP_PREFIX = 'backups/database/';

async function backupDatabase() {
  console.log('💾 MetaMesh-UGA Database Backup');
  console.log('='.repeat(50));
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = `metamesh-catalog-${timestamp}.sql`;
  const localPath = path.join('/tmp', backupFile);
  
  try {
    // Export database
    console.log('→ Exporting database...');
    execSync(
      `wrangler d1 export metamesh-catalog --output=${localPath}`,
      { stdio: 'inherit' }
    );
    console.log('✓ Database exported');
    
    // Upload to R2
    console.log('→ Uploading to R2...');
    execSync(
      `wrangler r2 object put ${BACKUP_BUCKET}/${BACKUP_PREFIX}${backupFile} --file=${localPath}`,
      { stdio: 'inherit' }
    );
    console.log('✓ Backup uploaded to R2');
    
    // Clean up local file
    await fs.unlink(localPath);
    
    // Clean old backups (keep last 7)
    console.log('→ Cleaning old backups...');
    await cleanupOldBackups();
    
    console.log('\n✅ Backup complete!');
    console.log(`Location: r2://${BACKUP_BUCKET}/${BACKUP_PREFIX}${backupFile}`);
    
    // Send notification
    await sendBackupNotification(backupFile);
    
  } catch (error) {
    console.error('\n❌ Backup failed:', error.message);
    process.exit(1);
  }
}

async function cleanupOldBackups() {
  try {
    const result = execSync(
      `wrangler r2 object list ${BACKUP_BUCKET} --prefix=${BACKUP_PREFIX} --json`,
      { encoding: 'utf8' }
    );
    
    const objects = JSON.parse(result);
    const sorted = objects.sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
    
    // Delete backups older than 7 most recent
    const toDelete = sorted.slice(7);
    for (const obj of toDelete) {
      execSync(`wrangler r2 object delete ${BACKUP_BUCKET} ${obj.key}`, { stdio: 'pipe' });
      console.log(`  Deleted: ${obj.key}`);
    }
  } catch (e) {
    console.warn('Cleanup warning:', e.message);
  }
}

async function sendBackupNotification(filename) {
  const message = `💾 Database Backup Complete\n\nFile: ${filename}\nTime: ${new Date().toISOString()}`;
  
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

// Run
backupDatabase();
