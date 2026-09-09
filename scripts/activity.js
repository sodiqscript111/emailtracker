#!/usr/bin/env node

/**
 * CLI Email Tracker Activity Monitor
 * Usage:
 *   npm run activity
 *   npm run activity -- --watch
 *   npm run activity -- --sender=example@gmail.com
 */

const fs = require('fs');
const path = require('path');

// Read local .env if available
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = (match[2] || '').trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
} catch {
  // Ignore env read failure
}

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8787';
const API_TOKEN = process.env.API_AUTH_TOKEN || 'dev-secret-token-change-in-prod';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:5173';

const args = process.argv.slice(2);
const isWatch = args.includes('--watch') || args.includes('-w');
const senderArg = args.find(a => a.startsWith('--sender='))?.split('=')[1];

async function fetchActivity() {
  try {
    const headers = {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    };

    // 1. Fetch senders list
    const sendersRes = await fetch(`${API_BASE_URL}/api/senders`, { headers });
    let senders = [];
    if (sendersRes.ok) {
      const data = await sendersRes.json();
      senders = data.senders || [];
    }

    // 2. Fetch tracked emails
    let emailsUrl = `${API_BASE_URL}/api/tracked-emails?limit=50`;
    if (senderArg) {
      emailsUrl += `&senderEmail=${encodeURIComponent(senderArg)}`;
    }

    const emailsRes = await fetch(emailsUrl, { headers });
    if (!emailsRes.ok) {
      console.error(`\x1b[31mError fetching activity: HTTP ${emailsRes.status} ${emailsRes.statusText}\x1b[0m`);
      return;
    }

    const emailsData = await emailsRes.json();
    const emails = emailsData.items || [];
    const total = emailsData.total || emails.length;

    if (isWatch) {
      console.clear();
    }

    console.log('\x1b[36m===============================================================\x1b[0m');
    console.log('\x1b[1m\x1b[32m       📬 EMAIL TRACKER - LIVE ACTIVITY MONITOR \x1b[0m');
    console.log(`\x1b[90m       Worker: ${API_BASE_URL}\x1b[0m`);
    console.log(`\x1b[90m       Dashboard: ${DASHBOARD_URL}\x1b[0m`);
    console.log('\x1b[36m===============================================================\x1b[0m');
    console.log(`Active Senders (${senders.length}): ${senders.length > 0 ? senders.join(', ') : 'None yet'}`);
    if (senderArg) {
      console.log(`Filtering by sender: \x1b[33m${senderArg}\x1b[0m`);
    }
    console.log(`Total Emails Tracked: \x1b[1m${total}\x1b[0m | Displaying: ${emails.length}`);
    console.log('---------------------------------------------------------------');

    if (emails.length === 0) {
      console.log('\n\x1b[33mNo tracked emails recorded yet.\x1b[0m');
      console.log('Send an email with the Chrome extension enabled to see it appear here!\n');
    } else {
      const formatted = emails.map(e => {
        const isOpened = (e.openCount && e.openCount > 0) || e.status === 'opened';
        const statusStr = isOpened 
          ? `\x1b[32mOPENED (${e.openCount}x)\x1b[0m` 
          : '\x1b[33mUNOPENED\x1b[0m';

        const sentDate = e.createdAt ? new Date(e.createdAt).toLocaleString() : '-';
        const openedDate = e.firstOpenedAt ? new Date(e.firstOpenedAt).toLocaleString() : '-';

        return {
          'Sender': e.senderEmail || '(unknown)',
          'Recipient': e.recipientEmail,
          'Subject': (e.subject || '(No Subject)').slice(0, 28),
          'Status': statusStr,
          'Opened At': openedDate,
          'Sent At': sentDate
        };
      });

      console.table(formatted);
    }

    const now = new Date().toLocaleTimeString();
    if (isWatch) {
      console.log(`\x1b[90mLast refreshed: ${now} (Auto-refreshing every 5s. Press Ctrl+C to exit)\x1b[0m`);
    } else {
      console.log(`\x1b[90mChecked at: ${now}. Tip: Run with --watch for live live-updating monitor.\x1b[0m`);
    }
  } catch (err) {
    console.error('\x1b[31mFailed to connect to tracker backend:\x1b[0m', err.message);
  }
}

fetchActivity();

if (isWatch) {
  setInterval(fetchActivity, 5000);
}
