-- Migration: Add gpx_filename column to study_runs
-- This stores the original GPX filename separately from the editable run name

ALTER TABLE study_runs ADD COLUMN gpx_filename TEXT;
