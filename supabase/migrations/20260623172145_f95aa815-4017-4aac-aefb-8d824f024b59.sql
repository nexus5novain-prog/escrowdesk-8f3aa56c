
-- 1) escrow_invoices
CREATE TABLE public.escrow_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL UNIQUE REFERENCES public.trades(id) ON DELETE CASCADE,
  btcpay_invoice_id text NOT NULL UNIQUE,
  bitcoin_address text,
  lightning_invoice text,
  amount_btc numeric(24,8) NOT NULL,
  paid_amount_btc numeric(24,8) NOT NULL DEFAULT 0,
  confirmations int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','processing','settled','expired','invalid')),
  expires_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.escrow_invoices TO authenticated;
GRANT ALL ON public.escrow_invoices TO service_role;
ALTER TABLE public.escrow_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trade parties read escrow invoice" ON public.escrow_invoices
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.trades t WHERE t.id = trade_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid()))
    OR public.is_staff(auth.uid())
  );
CREATE TRIGGER trg_escrow_invoices_updated BEFORE UPDATE ON public.escrow_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_escrow_invoices_status ON public.escrow_invoices(status);

-- 2) escrow_events (append-only)
CREATE TABLE public.escrow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid REFERENCES public.trades(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.escrow_invoices(id) ON DELETE CASCADE,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.escrow_events TO authenticated;
GRANT ALL ON public.escrow_events TO service_role;
ALTER TABLE public.escrow_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trade parties read escrow events" ON public.escrow_events
  FOR SELECT TO authenticated USING (
    trade_id IS NULL AND public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.trades t WHERE t.id = trade_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid()))
    OR public.is_staff(auth.uid())
  );
CREATE INDEX idx_escrow_events_trade ON public.escrow_events(trade_id, created_at DESC);

-- 3) payouts
CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('release','refund')),
  destination_address text NOT NULL,
  amount_btc numeric(24,8) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','broadcast','confirmed','failed','cancelled')),
  btcpay_payout_id text,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tx_hash text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trade parties + staff read payouts" ON public.payouts
  FOR SELECT TO authenticated USING (
    public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.trades t WHERE t.id = trade_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid()))
  );
CREATE TRIGGER trg_payouts_updated BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_payouts_status ON public.payouts(status);

-- 4) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.escrow_invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.escrow_events;
