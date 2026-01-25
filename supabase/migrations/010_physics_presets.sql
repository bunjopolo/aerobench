-- Physics Presets table for saving CdA, Crr, Mass, Efficiency, and Air Density values
CREATE TABLE physics_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  cda DECIMAL,
  crr DECIMAL,
  mass DECIMAL,
  efficiency DECIMAL,
  rho DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS policies
ALTER TABLE physics_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own presets" ON physics_presets
  FOR ALL USING (auth.uid() = user_id);
