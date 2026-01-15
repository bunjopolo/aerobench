-- Migration: Add mass and drivetrain_efficiency directly to studies table
-- This simplifies the data model by removing the need for separate "setups"

-- Add mass column (total system mass in kg: rider + bike + gear)
ALTER TABLE studies ADD COLUMN mass DECIMAL DEFAULT 80;

-- Add drivetrain efficiency column (typically 0.95-0.98)
ALTER TABLE studies ADD COLUMN drivetrain_efficiency DECIMAL DEFAULT 0.97;

-- Add comments for documentation
COMMENT ON COLUMN studies.mass IS 'Total system mass in kg (rider + bike + gear)';
COMMENT ON COLUMN studies.drivetrain_efficiency IS 'Drivetrain efficiency factor (typically 0.95-0.98)';
