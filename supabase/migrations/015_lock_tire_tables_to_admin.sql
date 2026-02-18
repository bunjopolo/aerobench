-- Lock tire tables to admin-only access while catalog is being seeded.

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((auth.jwt() ->> 'email') = 'eligarlick@gmail.com', false);
$$;

-- Tires table policies
DROP POLICY IF EXISTS "Anyone can read tires" ON tires;
DROP POLICY IF EXISTS "Authenticated users can create tires" ON tires;
DROP POLICY IF EXISTS "Authenticated users can update tires" ON tires;
DROP POLICY IF EXISTS "Authenticated users can delete tires" ON tires;

CREATE POLICY "Admin can read tires"
  ON tires FOR SELECT
  USING (public.is_admin_user());

CREATE POLICY "Admin can create tires"
  ON tires FOR INSERT
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admin can update tires"
  ON tires FOR UPDATE
  USING (public.is_admin_user());

CREATE POLICY "Admin can delete tires"
  ON tires FOR DELETE
  USING (public.is_admin_user());

-- Tire observations table policies
DROP POLICY IF EXISTS "Authenticated users can read tire observations" ON tire_observations;
DROP POLICY IF EXISTS "Users can create own tire observations" ON tire_observations;
DROP POLICY IF EXISTS "Users can update own tire observations" ON tire_observations;
DROP POLICY IF EXISTS "Users can delete own tire observations" ON tire_observations;

CREATE POLICY "Admin can read tire observations"
  ON tire_observations FOR SELECT
  USING (public.is_admin_user());

CREATE POLICY "Admin can create tire observations"
  ON tire_observations FOR INSERT
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admin can update tire observations"
  ON tire_observations FOR UPDATE
  USING (public.is_admin_user());

CREATE POLICY "Admin can delete tire observations"
  ON tire_observations FOR DELETE
  USING (public.is_admin_user());
