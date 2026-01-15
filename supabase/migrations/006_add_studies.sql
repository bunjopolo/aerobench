-- Migration: Add Studies tables for structured testing
-- This enables users to create studies that test specific variables (wheels, tire pressure, etc.)
-- Each study contains variations (different values to test) and runs (individual GPX analyses)

-- Studies: Container for a test
CREATE TABLE studies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  -- What variable is being tested
  variable_type TEXT NOT NULL, -- 'wheels', 'tires', 'tire_pressure', 'position', 'surface', 'helmet', 'clothing', 'custom'
  variable_label TEXT, -- For custom types: user-defined label
  -- Link to base setup (equipment constants across variations)
  base_setup_id UUID REFERENCES setups(id) ON DELETE SET NULL,
  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'archived'
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Study variations: Different values of the test variable
CREATE TABLE study_variations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  study_id UUID REFERENCES studies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  -- Display name for this variation
  name TEXT NOT NULL,
  -- The variation value (format depends on variable_type)
  value_text TEXT, -- For text types: "Zipp 404", "GP5000", "Bell Aero"
  value_number DECIMAL, -- For numeric types (single value)
  value_number_front DECIMAL, -- For tire pressure: front PSI
  value_number_rear DECIMAL, -- For tire pressure: rear PSI
  -- Display order
  sort_order INTEGER DEFAULT 0,
  -- Aggregated results (computed from runs)
  avg_cda DECIMAL,
  avg_crr DECIMAL,
  run_count INTEGER DEFAULT 0,
  -- Metadata
  notes TEXT,
  is_baseline BOOLEAN DEFAULT false, -- Mark as baseline for comparison
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Study runs: Individual GPX analyses within a variation
CREATE TABLE study_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variation_id UUID REFERENCES study_variations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  -- Run name (optional, defaults to date)
  name TEXT,
  -- Results from GPX analysis
  fitted_cda DECIMAL,
  fitted_crr DECIMAL,
  rmse DECIMAL,
  r2 REAL,
  -- Conditions during the run
  wind_speed DECIMAL,
  wind_direction DECIMAL,
  temperature DECIMAL,
  -- Quality flags
  is_valid BOOLEAN DEFAULT true, -- User can mark as invalid/excluded
  -- Metadata
  ride_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_studies_user_id ON studies(user_id);
CREATE INDEX idx_studies_status ON studies(status);
CREATE INDEX idx_studies_created_at ON studies(created_at DESC);
CREATE INDEX idx_variations_study_id ON study_variations(study_id);
CREATE INDEX idx_variations_user_id ON study_variations(user_id);
CREATE INDEX idx_runs_variation_id ON study_runs(variation_id);
CREATE INDEX idx_runs_user_id ON study_runs(user_id);

-- Enable Row Level Security
ALTER TABLE studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for studies
CREATE POLICY "Users can view own studies" ON studies
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own studies" ON studies
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own studies" ON studies
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own studies" ON studies
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for study_variations
CREATE POLICY "Users can view own variations" ON study_variations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own variations" ON study_variations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own variations" ON study_variations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own variations" ON study_variations
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for study_runs
CREATE POLICY "Users can view own runs" ON study_runs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own runs" ON study_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own runs" ON study_runs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own runs" ON study_runs
  FOR DELETE USING (auth.uid() = user_id);
