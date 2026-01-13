-- Add r2 (R-squared) column to analyses table
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS r2 REAL;
