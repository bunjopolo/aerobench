-- Tires catalog + crowd-sourced observation records

CREATE TABLE IF NOT EXISTS tires (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  version TEXT,
  category TEXT NOT NULL DEFAULT 'road',
  tire_type TEXT,
  size_label TEXT,
  width_nominal_mm DECIMAL,
  brr_drum_crr DECIMAL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tires_brand_model ON tires(brand, model);
CREATE INDEX IF NOT EXISTS idx_tires_category ON tires(category);
CREATE INDEX IF NOT EXISTS idx_tires_active ON tires(is_active);

ALTER TABLE tires ENABLE ROW LEVEL SECURITY;

-- Catalog should be visible to everyone using the app.
DROP POLICY IF EXISTS "Anyone can read tires" ON tires;
CREATE POLICY "Anyone can read tires"
  ON tires FOR SELECT
  USING (true);

-- Admin checks are handled in the app; only signed-in users can mutate.
DROP POLICY IF EXISTS "Authenticated users can create tires" ON tires;
CREATE POLICY "Authenticated users can create tires"
  ON tires FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update tires" ON tires;
CREATE POLICY "Authenticated users can update tires"
  ON tires FOR UPDATE
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete tires" ON tires;
CREATE POLICY "Authenticated users can delete tires"
  ON tires FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Real-world observations linked to solved analyses/runs.
CREATE TABLE IF NOT EXISTS tire_observations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_study_run_id UUID REFERENCES study_runs(id) ON DELETE SET NULL,
  source_analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,
  tire_id UUID NOT NULL REFERENCES tires(id) ON DELETE RESTRICT,
  pressure_psi DECIMAL,
  surface TEXT,
  temperature_c DECIMAL,
  rho DECIMAL,
  fitted_crr DECIMAL NOT NULL,
  fitted_cda DECIMAL,
  rmse DECIMAL,
  r2 REAL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tire_observations_tire_id ON tire_observations(tire_id);
CREATE INDEX IF NOT EXISTS idx_tire_observations_user_id ON tire_observations(user_id);
CREATE INDEX IF NOT EXISTS idx_tire_observations_created_at ON tire_observations(created_at DESC);

ALTER TABLE tire_observations ENABLE ROW LEVEL SECURITY;

-- Observations are readable by all authenticated users for shared insights.
DROP POLICY IF EXISTS "Authenticated users can read tire observations" ON tire_observations;
CREATE POLICY "Authenticated users can read tire observations"
  ON tire_observations FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can create own tire observations" ON tire_observations;
CREATE POLICY "Users can create own tire observations"
  ON tire_observations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tire observations" ON tire_observations;
CREATE POLICY "Users can update own tire observations"
  ON tire_observations FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tire observations" ON tire_observations;
CREATE POLICY "Users can delete own tire observations"
  ON tire_observations FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE setups
  ADD COLUMN IF NOT EXISTS tire_id UUID REFERENCES tires(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_setups_tire_id ON setups(tire_id);
