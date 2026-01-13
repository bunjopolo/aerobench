-- Function to delete a user and all their data
-- This must be called by the authenticated user to delete themselves

CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete the user's profile (cascades to setups, analyses, comparisons)
  DELETE FROM profiles WHERE id = auth.uid();

  -- Delete the user from auth.users
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;
