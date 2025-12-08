-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Security definer function to get admin stats (bypasses RLS)
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
    SELECT ca.user_id, SUM((ca.stats->>'sent')::int) as messages_sent
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

-- Function to update subscription as admin
CREATE OR REPLACE FUNCTION public.admin_update_subscription(
  _user_id UUID,
  _status subscription_status,
  _plan_type TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.subscriptions
  SET 
    status = _status,
    plan_type = COALESCE(_plan_type, plan_type),
    updated_at = now()
  WHERE user_id = _user_id;

  RETURN FOUND;
END;
$$;

-- Insert admin role for super admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'andreguimel@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;