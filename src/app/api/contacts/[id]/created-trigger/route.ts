import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { runAutomationsForTrigger } from '@/lib/automations/engine';

/**
 * Dispatches `new_contact_created` for a contact just created via the
 * Dashboard's "Add Contact" form (contact-form.tsx), which inserts
 * directly into `contacts` from the browser and never went through
 * this trigger — unlike the WhatsApp webhook path, which already
 * dispatches it, and the public API path (POST /api/v1/contacts),
 * which was fixed earlier tonight to dispatch it too.
 *
 * Kept as a separate call after the form's insert (and its tag sync)
 * already succeeded, same reasoning as assigned-trigger/route.ts: a
 * bug here can only mean the welcome automation doesn't fire, never
 * that the contact itself fails to save.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireRole('agent');
    const { id: contactId } = await params;

    // Ownership check, same pattern as assigned-trigger — confirm this
    // contact is actually this account's before dispatching.
    const { data: contact, error: lookupError } = await ctx.supabase
      .from('contacts')
      .select('id')
      .eq('id', contactId)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json(
        { error: `contact lookup failed: ${lookupError.message}` },
        { status: 500 }
      );
    }
    if (!contact) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    await runAutomationsForTrigger({
      accountId: ctx.accountId,
      triggerType: 'new_contact_created',
      contactId,
      context: {},
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}