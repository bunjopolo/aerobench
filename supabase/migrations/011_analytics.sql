-- Analytics tables for tracking usage metrics

-- Page views / events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- 'page_view', 'action', 'feature_use'
  event_name TEXT NOT NULL, -- 'dashboard', 'quick_test', 'run_sweep', etc.
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily active users summary (materialized for fast queries)
CREATE TABLE IF NOT EXISTS analytics_daily_summary (
  date DATE PRIMARY KEY,
  unique_users INTEGER DEFAULT 0,
  total_events INTEGER DEFAULT 0,
  page_views INTEGER DEFAULT 0,
  feature_uses JSONB DEFAULT '{}', -- {"quick_test": 5, "sweep": 3, ...}
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);

-- RLS policies
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily_summary ENABLE ROW LEVEL SECURITY;

-- Anyone can insert events (for their own tracking)
CREATE POLICY "Users can insert their own events" ON analytics_events
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Only admin can read all events (we'll check email in the app)
CREATE POLICY "Admin can read all events" ON analytics_events
  FOR SELECT USING (true);

-- Admin can read daily summary
CREATE POLICY "Admin can read daily summary" ON analytics_daily_summary
  FOR SELECT USING (true);

-- Function to update daily summary
CREATE OR REPLACE FUNCTION update_daily_summary()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO analytics_daily_summary (date, unique_users, total_events, page_views, feature_uses)
  VALUES (
    DATE(NEW.created_at),
    1,
    1,
    CASE WHEN NEW.event_type = 'page_view' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'feature_use' THEN jsonb_build_object(NEW.event_name, 1) ELSE '{}' END
  )
  ON CONFLICT (date) DO UPDATE SET
    total_events = analytics_daily_summary.total_events + 1,
    page_views = analytics_daily_summary.page_views + CASE WHEN NEW.event_type = 'page_view' THEN 1 ELSE 0 END,
    feature_uses = CASE
      WHEN NEW.event_type = 'feature_use' THEN
        analytics_daily_summary.feature_uses || jsonb_build_object(
          NEW.event_name,
          COALESCE((analytics_daily_summary.feature_uses->>NEW.event_name)::integer, 0) + 1
        )
      ELSE analytics_daily_summary.feature_uses
    END,
    updated_at = NOW();

  -- Update unique users count (approximate, recalculated periodically)
  UPDATE analytics_daily_summary
  SET unique_users = (
    SELECT COUNT(DISTINCT user_id)
    FROM analytics_events
    WHERE DATE(created_at) = DATE(NEW.created_at) AND user_id IS NOT NULL
  )
  WHERE date = DATE(NEW.created_at);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update summary
DROP TRIGGER IF EXISTS trigger_update_daily_summary ON analytics_events;
CREATE TRIGGER trigger_update_daily_summary
  AFTER INSERT ON analytics_events
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_summary();

-- Function to get analytics for admin dashboard
CREATE OR REPLACE FUNCTION get_admin_analytics(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  date DATE,
  unique_users INTEGER,
  total_events INTEGER,
  page_views INTEGER,
  feature_uses JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ads.date,
    ads.unique_users,
    ads.total_events,
    ads.page_views,
    ads.feature_uses
  FROM analytics_daily_summary ads
  WHERE ads.date >= CURRENT_DATE - days_back
  ORDER BY ads.date DESC;
END;
$$ LANGUAGE plpgsql;
