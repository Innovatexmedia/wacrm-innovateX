-- ============================================================
-- 043: API campaigns
--
-- An "API campaign" is a long-lived broadcast row (kind = 'api') that a
-- template is bound to once. Each call to
-- POST /api/v1/campaigns/{id}/send adds ONE recipient row to it and
-- sends immediately, so the campaign's counts (sent / delivered / read /
-- replied / failed) keep growing through the existing aggregate trigger
-- and delivery webhooks.
--
--   1. broadcasts.kind      'standard' (default) | 'api'
--   2. broadcasts.status    gains 'active' — the resting state of an
--                           API campaign (it is never "done").
-- ============================================================

ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'standard';

ALTER TABLE broadcasts DROP CONSTRAINT IF EXISTS broadcasts_kind_check;
ALTER TABLE broadcasts
  ADD CONSTRAINT broadcasts_kind_check CHECK (kind IN ('standard', 'api'));

-- Drop whichever CHECK currently guards `status` (the inline constraint
-- from 001 has an auto-generated name), then re-add it with 'active'.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.broadcasts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.broadcasts DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE broadcasts
  ADD CONSTRAINT broadcasts_status_check
  CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'active'));

COMMENT ON COLUMN broadcasts.kind IS
  'standard = one-shot dashboard/API broadcast; api = reusable API campaign fed one recipient per POST /api/v1/campaigns/{id}/send. See 043_api_campaigns.sql.';