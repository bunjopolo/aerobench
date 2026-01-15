-- Migration: Add study_mode column to studies table
-- Allows distinguishing between 'averaging' studies (baseline establishment)
-- and 'comparison' studies (A/B testing equipment)

ALTER TABLE studies ADD COLUMN study_mode TEXT DEFAULT 'comparison';

-- Add comment for documentation
COMMENT ON COLUMN studies.study_mode IS 'Study type: averaging (baseline establishment) or comparison (A/B testing)';
