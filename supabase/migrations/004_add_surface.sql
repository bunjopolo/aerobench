-- Add surface column to setups table
ALTER TABLE setups ADD COLUMN IF NOT EXISTS surface TEXT;
