-- =============================================================================
-- Migration: add_skip_verification_to_trades
-- Date: 2026-05-22
-- =============================================================================
--
-- WHY:
--   Adds the skip-verification trade path. The proposer can offer to skip
--   photo verification; the acceptor then chooses Accept (no verification),
--   Accept (with verification), or Decline. Skip-accepted trades enter a new
--   'agreed_pending_handover' state rather than 'accepted' (which requires
--   both parties to complete photo verification first).
--
--   A separate 'physically_completed' terminal state is also introduced for
--   when both parties confirm the physical card exchange happened (or when
--   the 21-day auto-complete fires). Both new states are informational only —
--   no ownership transfer in printings or collection_entries occurs on any
--   trade completion path (see HANDOVER deferred item).
--
-- NEW COLUMNS:
--   proposer_offered_skip         — true when proposer toggled skip at propose time
--   verification_skipped          — true when acceptor chose 'no verification'
--   physical_handover_confirmed_at — set on user confirmation or day-21 auto-complete
--   physical_handover_auto_completed — true only when day-21 auto-complete fires
--
-- STATUS CONSTRAINT:
--   Adds 'agreed_pending_handover' and 'physically_completed' to the existing
--   CHECK constraint. Existing values ('completed', orphaned) are left untouched
--   per brief scope decision.
-- =============================================================================

BEGIN;

-- Add new columns
ALTER TABLE trades
  ADD COLUMN proposer_offered_skip         boolean NOT NULL DEFAULT false,
  ADD COLUMN verification_skipped          boolean NOT NULL DEFAULT false,
  ADD COLUMN physical_handover_confirmed_at timestamptz NULL,
  ADD COLUMN physical_handover_auto_completed boolean NOT NULL DEFAULT false;

-- Extend status CHECK constraint to include new states
ALTER TABLE trades DROP CONSTRAINT trades_status_check;

ALTER TABLE trades ADD CONSTRAINT trades_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'verification_required'::text,
    'accepted'::text,
    'agreed_pending_handover'::text,
    'physically_completed'::text,
    'declined'::text,
    'cancelled'::text,
    'completed'::text
  ]));

COMMIT;
