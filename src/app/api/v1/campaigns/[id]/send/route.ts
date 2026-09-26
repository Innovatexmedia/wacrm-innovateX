// ============================================================
// POST /api/v1/campaigns/{id}/send — send an API campaign's template
// to ONE recipient (scope: broadcasts:send).
//
// Body:
//   { "to": "+14155550123", "params": ["Jane", "ORD-42"] }
//
// `{id}` is the API campaign's id, shown on its page in the dashboard
// (Campaigns → New campaign → API Campaign). The message is sent
// synchronously; the response says whether Meta accepted it.
//
// Response (200):
//   { "data": { "campaign_id", "recipient_id", "message_id", "status": "sent" } }
// ============================================================

import { requireApiKey } from '@/lib/auth/api-context';
import { ok, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import { resolveAuditUserId, ContactError } from '@/lib/api/v1/contacts';
import { BroadcastError } from '@/lib/whatsapp/broadcast-core';
import { sendApiCampaignMessage } from '@/lib/whatsapp/api-campaign';

export const maxDuration = 30;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiKey(request, 'broadcasts:send');
    const { id } = await params;

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== 'object') {
      return fail('bad_request', 'Request body must be a JSON object', 400);
    }

    const to = typeof body.to === 'string' ? body.to : '';
    if (!to) {
      return fail('bad_request', "'to' is required", 400);
    }

    const auditUserId = await resolveAuditUserId(ctx.supabase, ctx.accountId);
    const result = await sendApiCampaignMessage(
      ctx.supabase,
      ctx.accountId,
      auditUserId,
      id,
      {
        to,
        params: Array.isArray(body.params) ? (body.params as string[]) : undefined,
      }
    );

    return ok(result);
  } catch (err) {
    if (err instanceof BroadcastError) {
      return fail(err.code, err.message, err.status);
    }
    if (err instanceof ContactError) {
      return fail(
        err.status === 400 ? 'bad_request' : 'internal',
        err.message,
        err.status
      );
    }
    return toApiErrorResponse(err);
  }
}