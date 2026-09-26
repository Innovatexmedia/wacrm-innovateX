import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

/**
 * PATCH — edit a scheduled campaign's send time, or cancel it.
 *
 * Deliberately narrow: only ever touches `scheduled_at` (and, for
 * cancel, `status`) on a row that is currently `status = 'scheduled'`.
 * Never touches recipients, never calls Meta, never runs anything —
 * api/broadcasts/scheduled-cron is still the only thing that actually
 * sends a scheduled campaign, and it only acts on rows this route
 * left as `scheduled` with a real future `scheduled_at`.
 *
 * Body: { action: 'reschedule', scheduled_at: string } — a future
 *   ISO timestamp, or { action: 'cancel' }.
 *
 * Cancel reuses the existing 'failed' status rather than adding a new
 * enum value — this database's `broadcasts.status` CHECK constraint
 * (draft/scheduled/sending/sent/failed) has no dedicated "cancelled"
 * state, and adding one is a schema change out of scope here. A
 * cancelled-before-it-ever-sent campaign is functionally identical to
 * a failed one from the cron's point of view (status !== 'scheduled',
 * so it's never picked up) — the only tradeoff is the status badge
 * reads "Failed" rather than "Cancelled" afterward.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const { id } = await params;

    const body = await request.json().catch(() => null);
    const action = body?.action;

    if (action === 'cancel') {
      const { data, error } = await supabase
        .from('broadcasts')
        .update({ status: 'failed' })
        .eq('id', id)
        .eq('account_id', accountId)
        .eq('status', 'scheduled') // only a still-scheduled campaign can be cancelled
        .select('id')
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) {
        return NextResponse.json(
          { error: 'This campaign is no longer scheduled — it may have just started sending.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'reschedule') {
      const scheduledAt = body?.scheduled_at;
      if (typeof scheduledAt !== 'string' || Number.isNaN(new Date(scheduledAt).getTime())) {
        return NextResponse.json({ error: 'scheduled_at must be a valid date' }, { status: 400 });
      }
      if (new Date(scheduledAt).getTime() <= Date.now()) {
        return NextResponse.json({ error: 'scheduled_at must be in the future' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('broadcasts')
        .update({ scheduled_at: new Date(scheduledAt).toISOString() })
        .eq('id', id)
        .eq('account_id', accountId)
        .eq('status', 'scheduled') // only a still-scheduled campaign can be rescheduled
        .select('id')
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) {
        return NextResponse.json(
          { error: 'This campaign is no longer scheduled — it may have just started sending.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'action must be "reschedule" or "cancel"' }, { status: 400 });
  } catch (error) {
    return toErrorResponse(error);
  }
}