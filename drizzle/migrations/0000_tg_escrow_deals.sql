CREATE TABLE public.tg_escrow_deals (
  deal_id text PRIMARY KEY,
  creator_tg_id bigint NOT NULL,
  creator_username text,
  group_id bigint UNIQUE,
  group_link text,
  buyer_tg_id bigint,
  buyer_username text,
  buyer_address text,
  seller_tg_id bigint,
  seller_username text,
  seller_address text,
  network text,
  escrow_address text,
  status text NOT NULL DEFAULT 'created',
  deposited_amount numeric NOT NULL DEFAULT 0,
  txid text,
  funded_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tg_escrow_deals TO service_role;
ALTER TABLE public.tg_escrow_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view tg deals" ON public.tg_escrow_deals FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
GRANT SELECT ON public.tg_escrow_deals TO authenticated;