CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at, trial_expires_at, trial_tier, subscription_tier)
  VALUES (
    NEW.id,
    NEW.email,
    NOW(),
    NOW() + INTERVAL '14 days',
    'pro',
    'free'
  )
  ON CONFLICT (id) DO UPDATE SET
    trial_expires_at = COALESCE(public.users.trial_expires_at, NOW() + INTERVAL '14 days'),
    trial_tier = COALESCE(public.users.trial_tier, 'pro');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
