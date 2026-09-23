import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { runAutomationsForTrigger } from '@/lib/automations/engine';

/**
 * Dispatches the `conversation_assigned` automation trigger.
 *
 * This trigger has never fired anywhere in the app — the type exists
 * (AutomationTriggerType, the builder's dropdown) but no code path
 * ever called runAutomationsForTrigger with it. This route is that
 * missing dispatch point, called right after a conversation's
 * assignment is written (see message-thread.tsx's handleAssignChange,
 * which does the actual `conversations.assigned_agent_id` update via
 * a direct client-side Supabase call — left untouched here on
 * purpose, so a bug in this new route can only mean the trigger
 * doesn't fire, never that an assignment silently fails to save).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireRole('agent');
    const { id: conversationId } = await params;

    const body = (await request.json().catch(() => null)) as {
      agent_id?: unknown;
    } | null;
    const agentId =
      typeof body?.agent_id === 'string' && body.agent_id.trim()
        ? body.agent_id.trim()
        : null;

    // Ownership check mirrors the tenant-isolation pattern used
    // elsewhere (e.g. tag-events.ts) — look the row up scoped to this
    // account before dispatching, rather than trusting the path
    // param alone.
    const { data: conversation, error: lookupError } = await ctx.supabase
      .from('conversations')
      .select('id, contact_id')
      .eq('id', conversationId)
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json(
        { error: `conversation lookup failed: ${lookupError.message}` },
        { status: 500 }
      );
    }
    if (!conversation) {
      // Not this account's conversation — same "pretend it doesn't
      // exist" response as the rest of the API for cross-tenant IDs.
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    await runAutomationsForTrigger({
      accountId: ctx.accountId,
      triggerType: 'conversation_assigned',
      contactId: conversation.contact_id,
      context: agentId ? { agent_id: agentId } : {},
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}