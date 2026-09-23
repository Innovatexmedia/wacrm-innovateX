import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { sendTemplateMessage } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'
import { resolveTemplateRow } from '@/lib/whatsapp/template-body'
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
} from '@/lib/whatsapp/phone-utils'
import type { SendTimeParams } from '@/lib/whatsapp/template-send-builder'

/**
 * Sends broadcasts whose `scheduled_at` has arrived — the other half
 * of the Dashboard wizard's "Schedule for Later" option. The wizard
 * (use-broadcast-sending.ts) only creates the `broadcasts` +
 * `broadcast_recipients` rows for a scheduled send and stops there;
 * this cron is what actually calls Meta, later, when due. Meant to be
 * hit every minute by an external pinger — same shared-secret pattern
 * as the other cron routes in this app.
 *
 * Mirrors api/whatsapp/broadcast's send loop (phone-variant retry,
 * same messageParams shape) since that's the route this replaces the
 * timing of — but reads from broadcast_recipients (header_media_url
 * off `broadcasts`, button_params off each recipient row) instead of
 * an in-memory payload, since nothing in-memory survives from wizard
 * submission to whenever `scheduled_at` actually arrives.
 */

const BATCH_SIZE = 20 // broadcasts claimed per run, not recipients per broadcast
const MAX_RECIPIENTS_PER_RUN = 500 // per broadcast, per cron invocation

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
  const { data: due, error } = await admin
    .from('broadcasts')
    .select('id, account_id, template_name, template_language, header_media_url')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .limit(BATCH_SIZE)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!due || due.length === 0) return NextResponse.json({ processed: 0 })

  let processed = 0

  for (const broadcast of due) {
    // Claim: 'scheduled' -> 'sending', conditioned on still being
    // 'scheduled'. If this returns no row, another invocation (or an
    // overlapping retry) already claimed it — skip, don't double-send.
    const { data: claimed } = await admin
      .from('broadcasts')
      .update({ status: 'sending' })
      .eq('id', broadcast.id)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle()
    if (!claimed) continue

    try {
      await sendClaimedBroadcast(admin, broadcast)
      processed++
    } catch (err) {
      console.error(`[scheduled-cron] failed broadcast ${broadcast.id}:`, err)
      await admin.from('broadcasts').update({ status: 'failed' }).eq('id', broadcast.id)
    }
  }

  return NextResponse.json({ processed })
}

async function sendClaimedBroadcast(
  admin: ReturnType<typeof supabaseAdmin>,
  broadcast: {
    id: string
    account_id: string
    template_name: string
    template_language: string
    header_media_url: string | null
  },
) {
  const { data: config, error: configError } = await admin
    .from('whatsapp_config')
    .select('*')
    .eq('account_id', broadcast.account_id)
    .single()
  if (configError || !config) {
    throw new Error('WhatsApp not configured for this account')
  }
  const accessToken = decrypt(config.access_token)

  const resolvedTemplate = await resolveTemplateRow(
    admin,
    broadcast.account_id,
    broadcast.template_name,
    broadcast.template_language,
  )
  if (resolvedTemplate.malformed) {
    throw new Error('Template row is malformed locally')
  }
  const templateRow = resolvedTemplate.row
  const headerType = templateRow?.header_type
  const isMediaHeader =
    headerType === 'image' || headerType === 'video' || headerType === 'document'

  const { data: recipients, error: recipientsError } = await admin
    .from('broadcast_recipients')
    .select('id, template_params, button_params, contact:contacts(phone)')
    .eq('broadcast_id', broadcast.id)
    .eq('status', 'pending')
    .limit(MAX_RECIPIENTS_PER_RUN)
  if (recipientsError) throw new Error(recipientsError.message)
  if (!recipients || recipients.length === 0) {
    // Nothing pending (e.g. an empty audience at send time) — still a
    // completed broadcast, not a failure.
    await admin.from('broadcasts').update({ status: 'sent' }).eq('id', broadcast.id)
    return
  }

  let failedCount = 0

  for (const recipient of recipients) {
    const contact = recipient.contact as unknown as { phone: string | null } | null
    const rawPhone = contact?.phone
    if (!rawPhone) {
      failedCount++
      await admin
        .from('broadcast_recipients')
        .update({ status: 'failed', error_message: 'No phone number on contact' })
        .eq('id', recipient.id)
      continue
    }

    const sanitized = sanitizePhoneForMeta(rawPhone)
    if (!isValidE164(sanitized)) {
      failedCount++
      await admin
        .from('broadcast_recipients')
        .update({ status: 'failed', error_message: 'Invalid phone number format' })
        .eq('id', recipient.id)
      continue
    }

    const buttonParams = recipient.button_params as Record<string, string> | null
    const hasButtonParams = buttonParams && Object.keys(buttonParams).length > 0
    const messageParams: SendTimeParams | undefined =
      (isMediaHeader && broadcast.header_media_url) || hasButtonParams
        ? {
            ...(isMediaHeader && broadcast.header_media_url
              ? { headerMediaUrl: broadcast.header_media_url }
              : {}),
            ...(hasButtonParams
              ? {
                  buttonParams: Object.fromEntries(
                    Object.entries(buttonParams!).map(([k, v]) => [Number(k), v]),
                  ),
                }
              : {}),
          }
        : undefined

    const variants = phoneVariants(sanitized)
    let sentMessageId: string | null = null
    let lastError: string | null = null

    for (const variant of variants) {
      try {
        const result = await sendTemplateMessage({
          phoneNumberId: config.phone_number_id,
          accessToken,
          to: variant,
          templateName: broadcast.template_name,
          language: resolvedTemplate.language,
          template: templateRow ?? undefined,
          messageParams,
          params: Array.isArray(recipient.template_params)
            ? (recipient.template_params as string[])
            : [],
        })
        sentMessageId = result.messageId
        lastError = null
        break
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        if (!isRecipientNotAllowedError(msg)) {
          lastError = msg
          break
        }
        lastError = msg // retry with next variant
      }
    }

    if (sentMessageId) {
      await admin
        .from('broadcast_recipients')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          whatsapp_message_id: sentMessageId,
          error_message: null,
        })
        .eq('id', recipient.id)
    } else {
      failedCount++
      await admin
        .from('broadcast_recipients')
        .update({ status: 'failed', error_message: lastError ?? 'Unknown error' })
        .eq('id', recipient.id)
    }
  }

  const finalStatus = failedCount === recipients.length ? 'failed' : 'sent'

  // If this run only got through part of a large audience (more than
  // MAX_RECIPIENTS_PER_RUN pending), leave it claimable again rather
  // than finalizing early — otherwise the remaining 'pending' rows
  // would never get sent (status is no longer 'scheduled', so the
  // "due" query above stops matching this broadcast at all).
  const { count: stillPending } = await admin
    .from('broadcast_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('broadcast_id', broadcast.id)
    .eq('status', 'pending')

  await admin
    .from('broadcasts')
    .update({ status: stillPending && stillPending > 0 ? 'scheduled' : finalStatus })
    .eq('id', broadcast.id)
}