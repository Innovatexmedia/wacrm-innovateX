#!/usr/bin/env node
/**
 * Workshop reminder sender.
 *
 * Fetches every contact carrying the given tag (your workshop's
 * registrant tag), then launches a template broadcast to all of them
 * via the CRM's public API (POST /api/v1/broadcasts).
 *
 * Usage:
 *   node send-reminder.js --tag workshop-oct12 --template workshop_3hr_left
 *
 * Required environment variables:
 *   CRM_BASE_URL   e.g. https://your-crm.example.com
 *   CRM_API_KEY    e.g. wacrm_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *
 * Optional flags:
 *   --tag        (required) tag name to filter registrants by
 *   --template   (required) approved WhatsApp template name to send
 *   --language   template language code (default: en_US)
 *   --dry-run    print who WOULD be messaged, without sending anything
 */

const BASE_URL = process.env.CRM_BASE_URL;
const API_KEY = process.env.CRM_API_KEY;

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { language: 'en_US', dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--tag') out.tag = args[++i];
    else if (a === '--template') out.template = args[++i];
    else if (a === '--language') out.language = args[++i];
    else if (a === '--dry-run') out.dryRun = true;
  }
  return out;
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    throw new Error(`${path} failed: ${msg}`);
  }
  return body;
}

/** Paginate through every contact, filter to those with the given tag. */
async function fetchRegistrants(tagName) {
  const matches = [];
  let cursor = null;

  do {
    const qs = new URLSearchParams({ limit: '100' });
    if (cursor) qs.set('cursor', cursor);
    const page = await apiFetch(`/api/v1/contacts?${qs.toString()}`);

    for (const contact of page.data) {
      const hasTag = (contact.tags || []).some(
        (t) => t.name.toLowerCase() === tagName.toLowerCase()
      );
      if (hasTag && contact.phone) {
        // Contacts can be stored with or without a leading "+" depending
        // on how they were created (the public API strips it; CSV import
        // keeps whatever was in the file). The broadcast API requires a
        // leading "+", so normalize here.
        const to = contact.phone.startsWith('+') ? contact.phone : `+${contact.phone}`;
        matches.push({ to, name: contact.name || undefined });
      }
    }

    cursor = page.meta?.next_cursor || null;
  } while (cursor);

  return matches;
}

/** Send in batches of 1000 — the API's per-request recipient cap. */
async function sendBroadcast(name, templateName, language, recipients) {
  const BATCH_SIZE = 1000;
  const results = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const result = await apiFetch('/api/v1/broadcasts', {
      method: 'POST',
      body: JSON.stringify({
        name: `${name} (batch ${Math.floor(i / BATCH_SIZE) + 1})`,
        template_name: templateName,
        template_language: language,
        recipients: batch.map((r) => ({ to: r.to })),
      }),
    });
    results.push(result.data);
  }

  return results;
}

async function main() {
  const { tag, template, language, dryRun } = parseArgs();

  if (!BASE_URL || !API_KEY) {
    console.error('Missing CRM_BASE_URL or CRM_API_KEY environment variable.');
    process.exit(1);
  }
  if (!tag || !template) {
    console.error('Usage: node send-reminder.js --tag <tagName> --template <templateName> [--language en_US] [--dry-run]');
    process.exit(1);
  }

  console.log(`Fetching contacts tagged "${tag}"...`);
  const registrants = await fetchRegistrants(tag);
  console.log(`Found ${registrants.length} registrant(s).`);

  if (registrants.length === 0) {
    console.log('Nothing to send — no contacts carry that tag.');
    return;
  }

  if (dryRun) {
    console.log('--dry-run: would message these numbers:');
    for (const r of registrants) console.log(`  ${r.to}${r.name ? ` (${r.name})` : ''}`);
    return;
  }

  console.log(`Launching "${template}" to ${registrants.length} recipient(s)...`);
  const results = await sendBroadcast(
    `Workshop reminder — ${template}`,
    template,
    language,
    registrants
  );

  for (const r of results) {
    console.log(
      `Batch → broadcast_id=${r.broadcast_id} status=${r.status} accepted=${r.accepted} rejected=${r.rejected}`
    );
  }
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});