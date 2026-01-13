-- Add tire pressure columns to setups table
-- Run this in your Supabase SQL editor

ALTER TABLE setups ADD COLUMN IF NOT EXISTS front_tire_pressure DECIMAL;
ALTER TABLE setups ADD COLUMN IF NOT EXISTS rear_tire_pressure DECIMAL;
