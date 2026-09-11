#!/usr/bin/env node

/**
 * CLI Email Tracker Activity Monitor
 * Usage:
 *   npm run activity
 *   npm run activity -- --watch
 *   npm run activity -- --week
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

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const args = process.argv.slice(2);
const isWatch = args.includes('--watch') || args.includes('-w');
const isWeekFilter = args.includes('--week') || args.includes('-7') || args.includes('--followup');
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
    let emailsUrl = `${API_BASE_URL}/api/tracked-emails?limit=100`;
    if (senderArg) {
      emailsUrl += `&senderEmail=${encodeURIComponent(senderArg)}`;
    }

    const emailsRes = await fetch(emailsUrl, { headers });
    if (!emailsRes.ok) {
      console.error(`\x1b[31mError fetching activity: HTTP ${emailsRes.status} ${emailsRes.statusText}\x1b[0m`);
      return;
    }

    const emailsData = await emailsRes.json();
    let emails = emailsData.items || [];
    const total = emailsData.total || emails.length;

    // Calculate 7+ day old count
    const now = Date.now();
    const weekOldEmails = emails.filter(e => {
      const t = e.sentAt || e.createdAt;
      return t && (now - t) >= ONE_WEEK_MS;
    });

    if (isWeekFilter) {
      emails = weekOldEmails;
    }

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
    if (isWeekFilter) {
      console.log(`Filter Mode: \x1b[33m⏰ It's Been a Week (7d+ follow-up filter active)\x1b[0m`);
    }
    console.log(`Total Emails: \x1b[1m${total}\x1b[0m | 7d+ Follow-up Due: \x1b[1m\x1b[33m${weekOldEmails.length}\x1b[0m | Displaying: ${emails.length}`);
    console.log('---------------------------------------------------------------');

    if (emails.length === 0) {
      if (isWeekFilter) {
        console.log('\n\x1b[32m🎉 No follow-ups due! All your tracked emails are less than a week old.\x1b[0m\n');
      } else {
        console.log('\n\x1b[33mNo tracked emails recorded yet.\x1b[0m\n');
      }
    } else {
      const formatted = emails.map(e => {
        const isOpened = (e.openCount && e.openCount > 0) || e.status === 'opened';
        const statusStr = isOpened 
          ? `\x1b[32mOPENED (${e.openCount}x)\x1b[0m` 
          : '\x1b[33mUNOPENED\x1b[0m';

        const sentTimestamp = e.sentAt || e.createdAt;
        const diffMs = sentTimestamp ? (now - sentTimestamp) : 0;
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        let ageStr = '-';
        if (sentTimestamp) {
          if (days >= 7) {
            ageStr = `\x1b[33m⏰ ${days}d (Follow-up!)\x1b[0m`;
          } else if (days === 0) {
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            ageStr = hours <= 1 ? 'Today' : `${hours}h ago`;
          } else {
            ageStr = `${days}d ago`;
          }
        }

        const sentDate = sentTimestamp ? new Date(sentTimestamp).toLocaleDateString() : '-';

        return {
          'Recipient': e.recipientEmail,
          'Subject': (e.subject || '(No Subject)').slice(0, 28),
          'Status': statusStr,
          'Age / Follow-up': ageStr,
          'Sent Date': sentDate,
          'Sender': e.senderEmail || '(unknown)',
        };
      });

      console.table(formatted);
    }

    const timeStr = new Date().toLocaleTimeString();
    if (isWatch) {
      console.log(`\x1b[90mLast refreshed: ${timeStr} (Auto-refreshing every 5s. Press Ctrl+C to exit)\x1b[0m`);
    } else {
      console.log(`\x1b[90mChecked at: ${timeStr}. Tip: Run with --week to see 7-day follow-ups, or --watch for live updates.\x1b[0m`);
    }
  } catch (err) {
    console.error('\x1b[31mFailed to connect to tracker backend:\x1b[0m', err.message);
  }
}

fetchActivity();

if (isWatch) {
  setInterval(fetchActivity, 5000);
}
