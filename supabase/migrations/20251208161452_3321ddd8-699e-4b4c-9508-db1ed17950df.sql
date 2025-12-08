-- Drop and recreate the function with correct calculation
CREATE OR REPLACE FUNCTION public.get_admin_user_stats()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ,
  subscription_status TEXT,
  subscription_plan TEXT,
  trial_ends_at TIMESTAMPTZ,
  devices_count BIGINT,
  messages_sent BIGINT,
  campaigns_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to call this function
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email::TEXT,
    p.full_name,
    u.created_at,
    s.status::TEXT as subscription_status,
    s.plan_type as subscription_plan,
    s.trial_ends_at,
    COALESCE(e.devices_count, 0) as devices_count,
    COALESCE(m.messages_sent, 0) as messages_sent,
    COALESCE(c.campaigns_count, 0) as campaigns_count
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.subscriptions s ON s.user_id = u.id
  LEFT JOIN (
    SELECT ei.user_id, COUNT(*) as devices_count
    FROM public.evolution_instances ei
    GROUP BY ei.user_id
  ) e ON e.user_id = u.id
  LEFT JOIN (
    SELECT ca.user_id, 
      SUM(
        COALESCE((ca.stats->>'delivered')::int, 0) + 
        COALESCE((ca.stats->>'sent')::int, 0) + 
        COALESCE((ca.stats->>'failed')::int, 0)
      ) as messages_sent
    FROM public.campaigns ca
    GROUP BY ca.user_id
  ) m ON m.user_id = u.id
  LEFT JOIN (
    SELECT ca.user_id, COUNT(*) as campaigns_count
    FROM public.campaigns ca
    GROUP BY ca.user_id
  ) c ON c.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;