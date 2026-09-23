import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import type { TimeBasedTriggerConfig } from '@/types'

/**
 * Fires `time_based` automations whose schedule matches the current
 * time. Meant to be hit every minute by an external pinger (Vercel
 * Cron / cron-job.org / GitHub Actions) — same shared-secret pattern
 * as api/automations/cron.
 *
 * Scope, deliberately: only a plain "HH:mm" schedule (fires once
 * daily, in the automation's configured timezone) is supported here.
 * The trigger-config type and the builder's UI hint both mention full
 * cron expressions too (e.g. "0 9 * * 1-5") — that's NOT implemented
 * by this route. A schedule that isn't a bare HH:mm is skipped with
 * a warning rather than guessed at, since a hand-rolled cron-syntax
 * parser is exactly the kind of thing worth getting from a real,
 * tested library rather than writing fresh under time pressure.
 * Extending this to real cron syntax is a separate, standalone piece
 * of work.
 */

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

function currentHHMM(timezone: string): string | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    // en-GB gives "HH:mm" directly.
    return formatter.format(new Date())
  } catch {
    return null // invalid IANA timezone string in the automation's config
  }
}

function currentDateInTZ(timezone: string): string {
  // YYYY-MM-DD in the given timezone, for the fired_on column — so a
  // fire logged just before/after midnight lands on the day it
  // actually happened in that timezone, not in the server's.
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date())
}

export async function GET(request: Request) {
  const expected = process.env.AUTOMATION_CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 })
  }
  const supplied = request.headers.get('x-cron-secret') ?? ''
  const suppliedBuf = Buffer.from(supplied)
  const expectedBuf = Buffer.from(expected)
  if (
    suppliedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(suppliedBuf, expectedBuf)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const { data: automations, error } = await admin
    .from('automations')
    .select('id, account_id, trigger_config')
    .eq('trigger_type', 'time_based')
    .eq('is_active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!automations || automations.length === 0) {
    return NextResponse.json({ fired: 0, skipped: 0 })
  }

  let fired = 0
  let skipped = 0

  for (const automation of automations) {
    const cfg = (automation.trigger_config ?? {}) as TimeBasedTriggerConfig
    const schedule = (cfg.schedule ?? '').trim()
    const timezone = cfg.timezone?.trim() || 'UTC'

    if (!HHMM_RE.test(schedule)) {
      // Either a real cron expression (not supported here) or empty/
      // malformed config — either way, nothing this route can act on.
      skipped++
      continue
    }

    const nowHHMM = currentHHMM(timezone)
    if (nowHHMM !== schedule) continue // not this minute

    const firedOn = currentDateInTZ(timezone)

    // The unique constraint on (automation_id, fired_on,
    // fired_at_minute) is the actual dedupe guard — this insert is
    // the claim. If it conflicts, some other invocation (or an
    // overlapping retry) already fired this automation for this
    // exact minute today, so skip it here.
    const { error: claimError } = await admin
      .from('automation_time_fires')
      .insert({
        automation_id: automation.id,
        fired_on: firedOn,
        fired_at_minute: schedule,
      })

    if (claimError) {
      // Postgres unique_violation — expected on a genuine double-hit,
      // not a real failure.
      if ((claimError as { code?: string }).code === '23505') continue
      console.error(`[time-cron] claim failed for ${automation.id}:`, claimError.message)
      continue
    }

    await runAutomationsForTrigger({
      accountId: automation.account_id as string,
      triggerType: 'time_based',
      contactId: null,
      context: {},
    })
    fired++
  }

  // Light housekeeping: drop claim rows older than 7 days so this
  // table doesn't grow forever. Best-effort — a failure here doesn't
  // affect this run's firing above.
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  await admin.from('automation_time_fires').delete().lt('fired_on', cutoff)

  return NextResponse.json({ fired, skipped })
}