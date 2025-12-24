-- Create payments table to store payment history
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  mercadopago_payment_id TEXT,
  status TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'standard',
  payer_email TEXT,
  payer_id TEXT,
  payment_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
CREATE POLICY "Users can view own payments"
ON public.payments
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all payments
CREATE POLICY "Admins can view all payments"
ON public.payments
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert payments (from webhook)
CREATE POLICY "Service role can insert payments"
ON public.payments
FOR INSERT
WITH CHECK (true);

-- Create function to get payment stats for admin
CREATE OR REPLACE FUNCTION public.get_admin_payment_stats()
RETURNS TABLE(
  payment_id UUID,
  user_id UUID,
  user_email TEXT,
  mercadopago_payment_id TEXT,
  status TEXT,
  amount DECIMAL,
  plan_type TEXT,
  payer_email TEXT,
  payment_method TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    p.id as payment_id,
    p.user_id,
    u.email::TEXT as user_email,
    p.mercadopago_payment_id,
    p.status,
    p.amount,
    p.plan_type,
    p.payer_email,
    p.payment_method,
    p.created_at
  FROM public.payments p
  LEFT JOIN auth.users u ON u.id = p.user_id
  ORDER BY p.created_at DESC;
END;
$$;