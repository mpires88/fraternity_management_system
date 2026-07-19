-- ============================================================================
-- Phase 12.2 + 12.3 (schema portions): points ledger + lottery draft tables
--
-- Layout-pass decisions (user-approved): the lottery is OPTIONAL — one
-- producer of room_assignments among several. Only manual point adjustments
-- are materialized (activity points computed on read; required reason makes
-- fudging accountable). Entrants freeze standings at activation ("why am I
-- 7th" has a stored answer). Picks are IMMUTABLE draft history (the votes of
-- this domain) — never merged into the mutable room_assignments roster; a
-- SECURITY DEFINER trigger bridges them. Turn order is enforced in the
-- DATABASE, not the UI. pick_window_hours is a real column (per-turn timer;
-- skipped entrants may pick any time after their slot).
-- ============================================================================

-- ── housing_point_adjustments ────────────────────────────────────────────────

CREATE TABLE housing_point_adjustments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  person_id  uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  term_id    uuid REFERENCES terms(id) ON DELETE SET NULL,
  amount     numeric NOT NULL,
  reason     text NOT NULL,
  logged_by  uuid NOT NULL REFERENCES persons(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_housing_point_adjustments_person
  ON housing_point_adjustments(group_id, person_id);

ALTER TABLE housing_point_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "housing_point_adjustments_select" ON housing_point_adjustments
  FOR SELECT USING (group_id IN (SELECT get_my_group_ids()));

CREATE POLICY "housing_point_adjustments_insert" ON housing_point_adjustments
  FOR INSERT WITH CHECK (
    group_id IN (SELECT get_my_module_admin_group_ids('house_manager'))
    AND logged_by = (SELECT get_my_person_id())
  );

CREATE POLICY "housing_point_adjustments_update" ON housing_point_adjustments
  FOR UPDATE USING (group_id IN (SELECT get_my_module_admin_group_ids('house_manager')));

CREATE POLICY "housing_point_adjustments_delete" ON housing_point_adjustments
  FOR DELETE USING (group_id IN (SELECT get_my_module_admin_group_ids('house_manager')));

CREATE TRIGGER housing_point_adjustments_audit
  AFTER UPDATE OR DELETE ON housing_point_adjustments
  FOR EACH ROW EXECUTE FUNCTION log_data_change();

-- ── housing_lotteries ────────────────────────────────────────────────────────

CREATE TABLE housing_lotteries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id          uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  facility_id       uuid NOT NULL REFERENCES facilities(id),
  term_id           uuid NOT NULL REFERENCES terms(id),
  status            text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'active', 'completed', 'cancelled')),
  opens_at          timestamptz,
  closes_at         timestamptz,
  points_config     jsonb NOT NULL DEFAULT '{}',
  pick_window_hours int CHECK (pick_window_hours > 0),
  created_by        uuid NOT NULL REFERENCES persons(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, facility_id, term_id)
);

ALTER TABLE housing_lotteries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "housing_lotteries_select" ON housing_lotteries
  FOR SELECT USING (group_id IN (SELECT get_my_group_ids()));

CREATE POLICY "housing_lotteries_insert" ON housing_lotteries
  FOR INSERT WITH CHECK (
    group_id IN (SELECT get_my_module_admin_group_ids('house_manager'))
    AND created_by = (SELECT get_my_person_id())
  );

CREATE POLICY "housing_lotteries_update" ON housing_lotteries
  FOR UPDATE USING (group_id IN (SELECT get_my_module_admin_group_ids('house_manager')));

CREATE POLICY "housing_lotteries_delete" ON housing_lotteries
  FOR DELETE USING (group_id IN (SELECT get_my_module_admin_group_ids('house_manager')));

CREATE TRIGGER housing_lotteries_audit
  AFTER UPDATE OR DELETE ON housing_lotteries
  FOR EACH ROW EXECUTE FUNCTION log_data_change();

-- ── housing_lottery_entrants ─────────────────────────────────────────────────

CREATE TABLE housing_lottery_entrants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lottery_id       uuid NOT NULL REFERENCES housing_lotteries(id) ON DELETE CASCADE,
  person_id        uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  points_snapshot  numeric NOT NULL DEFAULT 0,
  points_breakdown jsonb,
  draft_order      int,
  turn_started_at  timestamptz,
  status           text NOT NULL DEFAULT 'eligible'
                   CHECK (status IN ('eligible', 'skipped', 'picked', 'withdrawn')),
  UNIQUE (lottery_id, person_id),
  UNIQUE (lottery_id, draft_order)
);

ALTER TABLE housing_lottery_entrants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "housing_lottery_entrants_select" ON housing_lottery_entrants
  FOR SELECT USING (
    lottery_id IN (SELECT id FROM housing_lotteries WHERE group_id IN (SELECT get_my_group_ids()))
  );

CREATE POLICY "housing_lottery_entrants_insert" ON housing_lottery_entrants
  FOR INSERT WITH CHECK (
    lottery_id IN (
      SELECT id FROM housing_lotteries
      WHERE group_id IN (SELECT get_my_module_admin_group_ids('house_manager'))
    )
  );

CREATE POLICY "housing_lottery_entrants_update" ON housing_lottery_entrants
  FOR UPDATE USING (
    lottery_id IN (
      SELECT id FROM housing_lotteries
      WHERE group_id IN (SELECT get_my_module_admin_group_ids('house_manager'))
    )
  );

CREATE POLICY "housing_lottery_entrants_delete" ON housing_lottery_entrants
  FOR DELETE USING (
    lottery_id IN (
      SELECT id FROM housing_lotteries
      WHERE group_id IN (SELECT get_my_module_admin_group_ids('house_manager'))
    )
  );

CREATE TRIGGER housing_lottery_entrants_audit
  AFTER UPDATE OR DELETE ON housing_lottery_entrants
  FOR EACH ROW EXECUTE FUNCTION log_data_change();

-- ── turn resolution (lazy skip on expired timers — no cron) ──────────────────

CREATE OR REPLACE FUNCTION current_lottery_turn(p_lottery_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id
  FROM housing_lottery_entrants e
  JOIN housing_lotteries l ON l.id = e.lottery_id
  WHERE e.lottery_id = p_lottery_id
    AND e.status = 'eligible'
    AND e.draft_order IS NOT NULL
    AND NOT (
      l.pick_window_hours IS NOT NULL
      AND e.turn_started_at IS NOT NULL
      AND e.turn_started_at + make_interval(hours => l.pick_window_hours) < now()
    )
  ORDER BY e.draft_order
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION current_lottery_turn(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION current_lottery_turn(uuid) TO service_role;

-- ── housing_lottery_picks (immutable; DB-enforced turns) ─────────────────────

CREATE TABLE housing_lottery_picks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lottery_id  uuid NOT NULL REFERENCES housing_lotteries(id) ON DELETE CASCADE,
  entrant_id  uuid NOT NULL REFERENCES housing_lottery_entrants(id),
  room_id     uuid NOT NULL REFERENCES rooms(id),
  pick_number int NOT NULL,
  picked_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lottery_id, entrant_id),
  UNIQUE (lottery_id, pick_number)
);

ALTER TABLE housing_lottery_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "housing_lottery_picks_select" ON housing_lottery_picks
  FOR SELECT USING (
    lottery_id IN (SELECT id FROM housing_lotteries WHERE group_id IN (SELECT get_my_group_ids()))
  );

-- Your own entrant row, during an active lottery, when it is your turn — or
-- your turn already opened and passed (skipped entrants may pick any time
-- after their slot). House managers may pick on behalf of an absent member.
-- No UPDATE/DELETE policies: picks are immutable, like votes.
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
          (
            e.person_id = (SELECT get_my_person_id())
            AND (e.id = current_lottery_turn(e.lottery_id) OR e.turn_started_at IS NOT NULL)
          )
          OR l.group_id IN (SELECT get_my_module_admin_group_ids('house_manager'))
        )
    )
  );

-- Capacity check + pick numbering (BEFORE), then side effects (AFTER):
-- entrant flips to picked, the next entrant's turn opens, and the canonical
-- room_assignments row is written — the single bridge between immutable draft
-- history and the mutable roster.

CREATE OR REPLACE FUNCTION enforce_lottery_pick()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity int;
  v_taken int;
BEGIN
  SELECT COALESCE(r.ideal_capacity, r.capacity) INTO v_capacity
  FROM rooms r WHERE r.id = NEW.room_id;

  IF v_capacity IS NOT NULL THEN
    SELECT count(*) INTO v_taken
    FROM housing_lottery_picks p
    WHERE p.lottery_id = NEW.lottery_id AND p.room_id = NEW.room_id;

    IF v_taken >= v_capacity THEN
      RAISE EXCEPTION 'room is full (capacity %)', v_capacity
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

CREATE TRIGGER housing_lottery_picks_before
  BEFORE INSERT ON housing_lottery_picks
  FOR EACH ROW EXECUTE FUNCTION enforce_lottery_pick();

CREATE OR REPLACE FUNCTION apply_lottery_pick()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_person uuid;
  v_term uuid;
  v_starts date;
  v_next uuid;
BEGIN
  SELECT e.person_id, l.term_id INTO v_person, v_term
  FROM housing_lottery_entrants e
  JOIN housing_lotteries l ON l.id = e.lottery_id
  WHERE e.id = NEW.entrant_id;

  UPDATE housing_lottery_entrants SET status = 'picked' WHERE id = NEW.entrant_id;

  SELECT starts_on INTO v_starts FROM terms WHERE id = v_term;

  INSERT INTO room_assignments (room_id, member_id, term_id, starts_on)
  VALUES (NEW.room_id, v_person, v_term, COALESCE(v_starts, CURRENT_DATE))
  ON CONFLICT DO NOTHING;

  -- Open the next entrant's turn if it has not started yet
  v_next := current_lottery_turn(NEW.lottery_id);
  IF v_next IS NOT NULL THEN
    UPDATE housing_lottery_entrants
    SET turn_started_at = now()
    WHERE id = v_next AND turn_started_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER housing_lottery_picks_after
  AFTER INSERT ON housing_lottery_picks
  FOR EACH ROW EXECUTE FUNCTION apply_lottery_pick();

-- ── grants ───────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON housing_point_adjustments, housing_lotteries, housing_lottery_entrants TO authenticated;
GRANT SELECT, INSERT ON housing_lottery_picks TO authenticated;
GRANT ALL ON housing_point_adjustments, housing_lotteries, housing_lottery_entrants, housing_lottery_picks TO service_role;
