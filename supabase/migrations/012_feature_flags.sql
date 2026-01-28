-- Feature flags table for controlling feature availability
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_key TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(feature_key);

-- RLS policies
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Anyone can read feature flags (needed for frontend)
CREATE POLICY "Anyone can read feature flags" ON feature_flags
  FOR SELECT USING (true);

-- Only authenticated users can update (we'll check admin in app)
CREATE POLICY "Authenticated users can update feature flags" ON feature_flags
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Only authenticated users can insert (we'll check admin in app)
CREATE POLICY "Authenticated users can insert feature flags" ON feature_flags
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Insert default feature flags
INSERT INTO feature_flags (feature_key, enabled, description) VALUES
  ('method_shen', false, 'Shen dual-acceleration method for CdA/Crr separation'),
  ('method_climb', false, 'Climb method using low/high speed runs'),
  ('method_sweep', false, '2D parameter sweep visualization')
ON CONFLICT (feature_key) DO NOTHING;

-- Function to update timestamp on changes
CREATE OR REPLACE FUNCTION update_feature_flags_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating timestamp
DROP TRIGGER IF EXISTS trigger_feature_flags_timestamp ON feature_flags;
CREATE TRIGGER trigger_feature_flags_timestamp
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_flags_timestamp();
