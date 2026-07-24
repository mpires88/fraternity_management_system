-- ============================================================================
-- Phase 12 review hardening (2026-07-23): close the holes found in the
-- housing re-scope + lottery schema review.
--
-- 1. SECURITY: nothing validated that a pick's room belongs to the lottery's
--    facility — the SECURITY DEFINER pick trigger would write a canonical
--    room_assignments row into ANY room platform-wide, bypassing the
--    house-manager write gate. Likewise a lottery could point at any
--    facility. Both are now bound.
-- 2. The "lazy skip, no cron" turn chain stalled after one expiry: the next
--    entrant's turn_started_at was only stamped by a successful pick, so two
--    consecutive absentees froze the draft. current_lottery_turn now walks
--    the order deriving implicit turn starts (predecessor's expiry), and a
--    new lottery_turn_open() gives the picks policy the same chain-aware
--    "current or passed" answer. Activation stamps the first turn in the DB.
-- 3. Capacity counted only this lottery's picks — blind to direct
--    assignments and to any other producer. It now counts live
--    room_assignments for the lottery's term, under a per-lottery advisory
--    lock + room row lock, which also serializes pick_number assignment
--    (previously a MAX+1 race saved only by an opaque unique violation).
-- 4. facilities.managed_by_group_id had no FK (ADD COLUMN IF NOT EXISTS
--    skipped the whole clause because the column already existed).
-- 5. Entrants were fully mutable mid-draft despite "the activation-time
--    order freeze IS the feature" — a lifecycle trigger now freezes
--    order/standings once active and requires entrants to be group members.
-- 6. Point adjustments accepted amount ±1e30 and an empty reason — the
--    "required reason makes fudging accountable" guarantee now holds at the
--    DB layer.
-- ============================================================================

-- ── 4. facilities.managed_by_group_id gets its missing FK ────────────────────

UPDATE facilities SET managed_by_group_id = NULL
WHERE managed_by_group_id IS NOT NULL
  AND managed_by_group_id NOT IN (SELECT id FROM groups);

ALTER TABLE facilities
  ADD CONSTRAINT facilities_managed_by_group_id_fkey
  FOREIGN KEY (managed_by_group_id) REFERENCES groups(id) ON DELETE SET NULL;

-- ── 6. point adjustments: accountable at the DB layer ────────────────────────

ALTER TABLE housing_point_adjustments
  ADD CONSTRAINT housing_point_adjustments_amount_check
  CHECK (amount <> 0 AND abs(amount) <= 10000);

ALTER TABLE housing_point_adjustments
  ADD CONSTRAINT housing_point_adjustments_reason_check
  CHECK (btrim(reason) <> '');

-- ── 1a. a lottery's facility must belong to the group's organization ─────────

CREATE OR REPLACE FUNCTION enforce_lottery_binding()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_facility_org uuid;
  v_group_org    uuid;
BEGIN
  SELECT organization_id INTO v_facility_org FROM facilities WHERE id = NEW.facility_id;
  SELECT organization_id INTO v_group_org FROM groups WHERE id = NEW.group_id;
  IF v_facility_org IS DISTINCT FROM v_group_org THEN
    RAISE EXCEPTION 'The lottery''s facility must belong to the group''s own organization';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER housing_lotteries_binding
  BEFORE INSERT OR UPDATE OF facility_id, group_id ON housing_lotteries
  FOR EACH ROW EXECUTE FUNCTION enforce_lottery_binding();

-- ── 2a. turn resolution: chain-aware, no stall on consecutive expiries ───────
-- Walk eligible entrants in draft order carrying a clock: an entrant's
-- effective turn start is their stamped turn_started_at, or — if the previous
-- turn expired unstamped — the predecessor's expiry. The first entrant whose
-- window is open (or who has no started/expired window, or no timer at all)
-- is current. Still STABLE and lazy: no writes, no cron.

CREATE OR REPLACE FUNCTION current_lottery_turn(p_lottery_id uuid)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window int;
  v_status text;
  v_clock  timestamptz;
  v_start  timestamptz;
  r        record;
BEGIN
  SELECT pick_window_hours, status INTO v_window, v_status
  FROM housing_lotteries WHERE id = p_lottery_id;

  IF v_status IS DISTINCT FROM 'active' THEN
    RETURN NULL;
  END IF;

  FOR r IN
    SELECT e.id, e.turn_started_at
    FROM housing_lottery_entrants e
    WHERE e.lottery_id = p_lottery_id
      AND e.status = 'eligible'
      AND e.draft_order IS NOT NULL
    ORDER BY e.draft_order
  LOOP
    v_start := COALESCE(r.turn_started_at, v_clock);
    IF v_window IS NULL
       OR v_start IS NULL
       OR v_start + make_interval(hours => v_window) > now() THEN
      RETURN r.id;
    END IF;
    -- Window came and went with no pick: implicit start of the next turn
    v_clock := v_start + make_interval(hours => v_window);
  END LOOP;

  RETURN NULL;
END;
$$;

-- ── 2b. may this entrant pick right now? (current turn, or turn passed) ──────
-- Used by the picks INSERT policy. An entrant may pick when the lottery is
-- active and: they were manager-skipped; OR it is their turn; OR every
-- eligible entrant before them expired AND their own effective window has
-- expired (the "skipped entrants pick any time after their slot" rule).

CREATE OR REPLACE FUNCTION lottery_turn_open(p_entrant_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lottery uuid;
  v_estatus text;
  v_lstatus text;
  v_window  int;
  v_clock   timestamptz;
  v_start   timestamptz;
  v_expiry  timestamptz;
  r         record;
BEGIN
  SELECT e.lottery_id, e.status, l.status, l.pick_window_hours
    INTO v_lottery, v_estatus, v_lstatus, v_window
  FROM housing_lottery_entrants e
  JOIN housing_lotteries l ON l.id = e.lottery_id
  WHERE e.id = p_entrant_id;

  IF v_lstatus IS DISTINCT FROM 'active' THEN
    RETURN false;
  END IF;
  IF v_estatus = 'skipped' THEN
    RETURN true;
  END IF;
  IF v_estatus <> 'eligible' THEN
    RETURN false;
  END IF;
  IF current_lottery_turn(v_lottery) = p_entrant_id THEN
    RETURN true;
  END IF;
  IF v_window IS NULL THEN
    RETURN false; -- no timer: only the current turn may pick
  END IF;

  -- Passed-turn check: walk the chain up to this entrant
  FOR r IN
    SELECT e.id, e.turn_started_at
    FROM housing_lottery_entrants e
    WHERE e.lottery_id = v_lottery
      AND e.status = 'eligible'
      AND e.draft_order IS NOT NULL
    ORDER BY e.draft_order
  LOOP
    v_start := COALESCE(r.turn_started_at, v_clock);
    IF r.id = p_entrant_id THEN
      RETURN v_start IS NOT NULL
         AND v_start + make_interval(hours => v_window) < now();
    END IF;
    IF v_start IS NULL THEN
      RETURN false; -- the chain has not reached them yet
    END IF;
    v_expiry := v_start + make_interval(hours => v_window);
    IF v_expiry > now() THEN
      RETURN false; -- someone before them is still on the clock
    END IF;
    v_clock := v_expiry;
  END LOOP;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION lottery_turn_open(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION lottery_turn_open(uuid) TO service_role;

DROP POLICY "housing_lottery_picks_insert" ON housing_lottery_picks;
CREATE POLICY "housing_lottery_picks_insert" ON housing_lottery_picks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM housing_lottery_entrants e
      JOIN housing_lotteries l ON l.id = e.lottery_id
      WHERE e.id = entrant_id
        AND e.lottery_id = housing_lottery_picks.lottery_id
        AND l.status = 'active'
        AND e.status IN ('eligible', 'skipped')
        AND (
          (e.person_id = (SELECT get_my_person_id()) AND lottery_turn_open(e.id))
          OR l.group_id IN (SELECT get_my_module_admin_group_ids('house_manager'))
        )
    )
  );

-- ── 2c. activation opens the first turn in the DB, not in app code ───────────

CREATE OR REPLACE FUNCTION stamp_first_lottery_turn()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE housing_lottery_entrants
  SET turn_started_at = now()
  WHERE id = (
    SELECT e.id FROM housing_lottery_entrants e
    WHERE e.lottery_id = NEW.id AND e.status = 'eligible' AND e.draft_order IS NOT NULL
    ORDER BY e.draft_order LIMIT 1
  )
  AND turn_started_at IS NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER housing_lotteries_activate
  AFTER UPDATE OF status ON housing_lotteries
  FOR EACH ROW
  WHEN (NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active')
  EXECUTE FUNCTION stamp_first_lottery_turn();

-- ── 1b + 3. picks: facility binding, real capacity, serialized numbering ─────

CREATE OR REPLACE FUNCTION enforce_lottery_pick()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_facility      uuid;
  v_term          uuid;
  v_room_facility uuid;
  v_capacity      int;
  v_taken         int;
BEGIN
  -- One pick at a time per lottery: serializes the capacity check and the
  -- pick_number assignment (no more MAX+1 races surfacing as raw unique
  -- violations)
  PERFORM pg_advisory_xact_lock(hashtextextended('housing_lottery:' || NEW.lottery_id::text, 0));

  SELECT l.facility_id, l.term_id INTO v_facility, v_term
  FROM housing_lotteries l WHERE l.id = NEW.lottery_id;

  -- Lock the room row so concurrent writers on the same room serialize even
  -- across lotteries
  SELECT r.facility_id, COALESCE(r.ideal_capacity, r.capacity)
    INTO v_room_facility, v_capacity
  FROM rooms r WHERE r.id = NEW.room_id
  FOR UPDATE;

  IF v_room_facility IS NULL OR v_room_facility IS DISTINCT FROM v_facility THEN
    RAISE EXCEPTION 'That room is not part of this lottery''s facility'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_capacity IS NOT NULL THEN
    -- Count the canonical roster, not just this lottery's picks: direct
    -- assignments and every other producer of room_assignments reduce
    -- capacity too (each prior pick wrote its own assignment row)
    SELECT count(*) INTO v_taken
    FROM room_assignments a
    WHERE a.room_id = NEW.room_id
      AND a.term_id = v_term
      AND (a.ends_on IS NULL OR a.ends_on >= CURRENT_DATE);

    IF v_taken >= v_capacity THEN
      RAISE EXCEPTION 'Room is full (capacity %)', v_capacity
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  NEW.pick_number := (
    SELECT COALESCE(max(pick_number), 0) + 1
    FROM housing_lottery_picks
    WHERE lottery_id = NEW.lottery_id
  );

  RETURN NEW;
END;
$$;

-- ── 5. entrants: freeze order/standings once the draft is live ───────────────

CREATE OR REPLACE FUNCTION enforce_lottery_entrant_lifecycle()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lstatus  text;
  v_group_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status, group_id INTO v_lstatus, v_group_id
    FROM housing_lotteries WHERE id = NEW.lottery_id;
    IF v_lstatus NOT IN ('draft', 'published') THEN
      RAISE EXCEPTION 'Entrants are frozen once the lottery is active';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM group_memberships gm
      WHERE gm.group_id = v_group_id
        AND gm.person_id = NEW.person_id
        AND gm.ended_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Entrants must be active members of the lottery''s group';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT status INTO v_lstatus FROM housing_lotteries WHERE id = OLD.lottery_id;
    IF v_lstatus NOT IN ('draft', 'published') THEN
      RAISE EXCEPTION 'Entrants are frozen once the lottery is active';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  SELECT status INTO v_lstatus FROM housing_lotteries WHERE id = OLD.lottery_id;
  IF v_lstatus IN ('draft', 'published') THEN
    RETURN NEW;
  END IF;
  IF v_lstatus = 'active' THEN
    -- Live draft: only status flips (skip/pick/withdraw) and turn timers may
    -- change — the frozen order and standings may not
    IF NEW.lottery_id <> OLD.lottery_id
       OR NEW.person_id <> OLD.person_id
       OR NEW.draft_order IS DISTINCT FROM OLD.draft_order
       OR NEW.points_snapshot IS DISTINCT FROM OLD.points_snapshot
       OR NEW.points_breakdown IS DISTINCT FROM OLD.points_breakdown THEN
      RAISE EXCEPTION 'Draft order and standings are frozen during an active draft';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'This lottery is % — entrants can no longer change', v_lstatus;
END;
$$;

CREATE TRIGGER housing_lottery_entrants_lifecycle
  BEFORE INSERT OR UPDATE OR DELETE ON housing_lottery_entrants
  FOR EACH ROW EXECUTE FUNCTION enforce_lottery_entrant_lifecycle();
