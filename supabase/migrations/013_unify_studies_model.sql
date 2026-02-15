-- Migration: Unify studies into a single baseline-first model
-- Removes legacy study_mode branching and hardens baseline invariants.

-- Legacy mode split is no longer used by the app.
ALTER TABLE studies DROP COLUMN IF EXISTS study_mode;

-- Ensure baseline flag is always explicit.
ALTER TABLE study_variations
  ALTER COLUMN is_baseline SET DEFAULT false;

UPDATE study_variations
SET is_baseline = false
WHERE is_baseline IS NULL;

ALTER TABLE study_variations
  ALTER COLUMN is_baseline SET NOT NULL;

-- Backfill: every study must have at least one configuration.
INSERT INTO study_variations (study_id, user_id, name, sort_order, is_baseline)
SELECT s.id, s.user_id, 'Baseline', 0, true
FROM studies s
LEFT JOIN study_variations v ON v.study_id = s.id
WHERE v.id IS NULL;

-- Normalize: keep exactly one baseline per study.
WITH ranked AS (
  SELECT
    id,
    study_id,
    ROW_NUMBER() OVER (
      PARTITION BY study_id
      ORDER BY is_baseline DESC, sort_order ASC NULLS LAST, created_at ASC, id ASC
    ) AS rn
  FROM study_variations
)
UPDATE study_variations v
SET is_baseline = (r.rn = 1)
FROM ranked r
WHERE v.id = r.id;

-- Enforce at most one baseline per study at the DB level.
CREATE UNIQUE INDEX IF NOT EXISTS idx_study_variations_one_baseline_per_study
ON study_variations (study_id)
WHERE is_baseline = true;

-- New studies automatically start with a baseline configuration.
CREATE OR REPLACE FUNCTION create_study_baseline_variation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO study_variations (study_id, user_id, name, sort_order, is_baseline)
  VALUES (NEW.id, NEW.user_id, 'Baseline', 0, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_study_baseline_variation ON studies;

CREATE TRIGGER trg_create_study_baseline_variation
AFTER INSERT ON studies
FOR EACH ROW
EXECUTE FUNCTION create_study_baseline_variation();

-- If a baseline is deleted, promote another variation automatically.
-- If the last variation is deleted (while study still exists), recreate baseline.
CREATE OR REPLACE FUNCTION ensure_study_baseline_after_variation_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- No action during cascading delete from studies table.
  IF NOT EXISTS (SELECT 1 FROM studies s WHERE s.id = OLD.study_id) THEN
    RETURN OLD;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM study_variations v WHERE v.study_id = OLD.study_id) THEN
    INSERT INTO study_variations (study_id, user_id, name, sort_order, is_baseline)
    SELECT s.id, s.user_id, 'Baseline', 0, true
    FROM studies s
    WHERE s.id = OLD.study_id;
    RETURN OLD;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM study_variations v
    WHERE v.study_id = OLD.study_id
      AND v.is_baseline = true
  ) THEN
    UPDATE study_variations
    SET is_baseline = true
    WHERE id = (
      SELECT v.id
      FROM study_variations v
      WHERE v.study_id = OLD.study_id
      ORDER BY v.sort_order ASC NULLS LAST, v.created_at ASC, v.id ASC
      LIMIT 1
    );
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_study_baseline_after_variation_delete ON study_variations;

CREATE TRIGGER trg_ensure_study_baseline_after_variation_delete
AFTER DELETE ON study_variations
FOR EACH ROW
EXECUTE FUNCTION ensure_study_baseline_after_variation_delete();

