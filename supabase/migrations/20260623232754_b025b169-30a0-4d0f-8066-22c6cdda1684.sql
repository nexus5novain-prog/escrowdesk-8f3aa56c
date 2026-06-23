-- =====================================================================
-- PHASE 1 — LEDGER TAKEOVER
-- =====================================================================

-- 1. Platform fees table (fees collected from completed trades)
CREATE TABLE IF NOT EXISTS public.platform_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid REFERENCES public.trades(id) ON DELETE SET NULL,
  fee_sats bigint NOT NULL CHECK (fee_sats > 0),
  source text NOT NULL,   -- 'trade_release' | 'dispute_resolution'
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_fees TO authenticated;
GRANT ALL    ON public.platform_fees TO service_role;

ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read platform fees"
  ON public.platform_fees FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Append-only: block UPDATE/DELETE
CREATE OR REPLACE FUNCTION public.tg_platform_fees_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'platform_fees is append-only'; END $$;

DROP TRIGGER IF EXISTS platform_fees_no_update ON public.platform_fees;
CREATE TRIGGER platform_fees_no_update
  BEFORE UPDATE OR DELETE ON public.platform_fees
  FOR EACH ROW EXECUTE FUNCTION public.tg_platform_fees_immutable();

-- 2. credit_wallet / debit_wallet — ledger-backed
CREATE OR REPLACE FUNCTION public.credit_wallet(
  _user uuid, _asset asset_type, _amount numeric, _note text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sats bigint;
BEGIN
  IF _asset <> 'BTC' THEN RAISE EXCEPTION 'Only BTC supported'; END IF;
  v_sats := floor(_amount * 100000000)::bigint;
  IF v_sats <= 0 THEN RAISE EXCEPTION 'amount must be > 0'; END IF;
  PERFORM public.ledger_credit(
    _user, 'available'::ledger_bucket, v_sats,
    'admin_adjustment'::ledger_kind, 'admin_adjustment', NULL,
    jsonb_build_object('note', _note));
END $$;

CREATE OR REPLACE FUNCTION public.debit_wallet(
  _user uuid, _asset asset_type, _amount numeric, _note text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sats bigint;
BEGIN
  IF _asset <> 'BTC' THEN RAISE EXCEPTION 'Only BTC supported'; END IF;
  v_sats := floor(_amount * 100000000)::bigint;
  IF v_sats <= 0 THEN RAISE EXCEPTION 'amount must be > 0'; END IF;
  PERFORM public.ledger_debit(
    _user, 'available'::ledger_bucket, v_sats,
    'admin_adjustment'::ledger_kind, 'admin_adjustment', NULL,
    jsonb_build_object('note', _note));
END $$;

REVOKE EXECUTE ON FUNCTION public.credit_wallet(uuid, asset_type, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_wallet (uuid, asset_type, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.credit_wallet(uuid, asset_type, numeric, text) TO service_role;
GRANT  EXECUTE ON FUNCTION public.debit_wallet (uuid, asset_type, numeric, text) TO service_role;

-- 3. start_trade — buyer locks crypto via ledger
CREATE OR REPLACE FUNCTION public.start_trade(
  _offer_id uuid, _buyer uuid, _fiat_amount numeric, _payment_method_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_offer offers%rowtype;
  v_seller uuid; v_buyer uuid;
  v_crypto numeric(24,8); v_fee numeric(24,8);
  v_fee_bps int; v_trade_id uuid; v_banned boolean; v_sats bigint;
BEGIN
  SELECT * INTO v_offer FROM offers WHERE id = _offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offer not found'; END IF;
  IF v_offer.status <> 'active' THEN RAISE EXCEPTION 'Offer not active'; END IF;
  IF v_offer.asset <> 'BTC' THEN RAISE EXCEPTION 'Only BTC supported'; END IF;
  IF _fiat_amount < v_offer.min_amount OR _fiat_amount > v_offer.max_amount THEN
    RAISE EXCEPTION 'Amount out of bounds'; END IF;
  IF v_offer.maker_id = _buyer THEN RAISE EXCEPTION 'Cannot trade with yourself'; END IF;
  SELECT is_banned INTO v_banned FROM profiles WHERE user_id = _buyer;
  IF v_banned THEN RAISE EXCEPTION 'Account is banned'; END IF;
  v_crypto := round(_fiat_amount / v_offer.price, 8);
  IF v_crypto > v_offer.available_crypto THEN RAISE EXCEPTION 'Not enough liquidity'; END IF;
  IF v_offer.side = 'sell' THEN v_seller := v_offer.maker_id; v_buyer := _buyer;
  ELSE v_seller := _buyer; v_buyer := v_offer.maker_id; END IF;
  v_fee_bps := compute_fee_bps(_fiat_amount);
  v_fee := round(v_crypto * v_fee_bps / 10000.0, 8);
  v_sats := floor(v_crypto * 100000000)::bigint;

  PERFORM public.ledger_transfer_bucket(
    v_buyer, 'available'::ledger_bucket, 'locked_escrow'::ledger_bucket,
    v_sats, 'escrow_lock'::ledger_kind, 'trade', NULL,
    jsonb_build_object('offer_id', _offer_id));

  UPDATE offers SET available_crypto = available_crypto - v_crypto WHERE id = _offer_id;

  INSERT INTO trades(offer_id, buyer_id, seller_id, asset, fiat_currency, price, crypto_amount, fiat_amount, fee_amount, payment_method_id, status)
  VALUES (_offer_id, v_buyer, v_seller, v_offer.asset, v_offer.fiat_currency, v_offer.price, v_crypto, _fiat_amount, v_fee, _payment_method_id, 'awaiting_agreement')
  RETURNING id INTO v_trade_id;

  INSERT INTO trade_messages(trade_id, sender_id, body, is_system)
    VALUES (v_trade_id, _buyer, 'Trade started. Both parties must propose & sign terms before deposit confirmation.', true);
  RETURN v_trade_id;
END; $$;

-- 4. release_trade — escrow -> seller; fee -> platform_fees
CREATE OR REPLACE FUNCTION public.release_trade(
  _trade_id uuid, _caller uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v trades%rowtype; v_total_sats bigint; v_fee_sats bigint; v_net_sats bigint;
BEGIN
  SELECT * INTO v FROM trades WHERE id = _trade_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trade not found'; END IF;
  IF v.buyer_id <> _caller AND NOT public.is_staff(_caller) THEN
    RAISE EXCEPTION 'Only buyer can release'; END IF;
  IF v.status NOT IN ('paid','disputed') THEN RAISE EXCEPTION 'Trade not releasable'; END IF;

  v_total_sats := floor(v.crypto_amount * 100000000)::bigint;
  v_fee_sats   := floor(v.fee_amount    * 100000000)::bigint;
  v_net_sats   := v_total_sats - v_fee_sats;

  PERFORM public.ledger_debit(v.buyer_id, 'locked_escrow'::ledger_bucket, v_total_sats,
    'escrow_release'::ledger_kind, 'trade', _trade_id, jsonb_build_object('side','buyer'));

  IF v_net_sats > 0 THEN
    PERFORM public.ledger_credit(v.seller_id, 'available'::ledger_bucket, v_net_sats,
      'escrow_release'::ledger_kind, 'trade', _trade_id, jsonb_build_object('side','seller'));
  END IF;

  IF v_fee_sats > 0 THEN
    INSERT INTO public.platform_fees (trade_id, fee_sats, source, metadata)
    VALUES (_trade_id, v_fee_sats, 'trade_release',
      jsonb_build_object('buyer_id', v.buyer_id, 'seller_id', v.seller_id));
  END IF;

  UPDATE trades SET status='released', released_at=now() WHERE id=_trade_id;
  UPDATE profiles SET trades_completed = trades_completed + 1 WHERE user_id IN (v.buyer_id, v.seller_id);
  PERFORM public.recompute_user_badges(v.buyer_id);
  PERFORM public.recompute_user_badges(v.seller_id);

  INSERT INTO trade_messages(trade_id, sender_id, body, is_system)
    VALUES (_trade_id, _caller, 'Crypto released to seller. Trade complete.', true);
END; $$;

-- 5. cancel_trade — refund escrow -> buyer available
CREATE OR REPLACE FUNCTION public.cancel_trade(
  _trade_id uuid, _caller uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v trades%rowtype; v_sats bigint;
BEGIN
  SELECT * INTO v FROM trades WHERE id = _trade_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trade not found'; END IF;
  IF v.buyer_id <> _caller AND v.seller_id <> _caller AND NOT public.is_staff(_caller) THEN
    RAISE EXCEPTION 'Not a participant'; END IF;
  IF v.status NOT IN ('awaiting_agreement','awaiting_deposit','awaiting_seller_confirm','pending_payment') THEN
    RAISE EXCEPTION 'Trade cannot be cancelled now'; END IF;

  v_sats := floor(v.crypto_amount * 100000000)::bigint;
  PERFORM public.ledger_transfer_bucket(v.buyer_id,
    'locked_escrow'::ledger_bucket, 'available'::ledger_bucket,
    v_sats, 'escrow_refund'::ledger_kind, 'trade', _trade_id,
    jsonb_build_object('reason','cancelled'));

  UPDATE offers SET available_crypto = available_crypto + v.crypto_amount WHERE id = v.offer_id;
  UPDATE trades SET status='cancelled', cancelled_at=now() WHERE id=_trade_id;
  INSERT INTO trade_messages(trade_id, sender_id, body, is_system)
    VALUES (_trade_id, _caller, 'Trade cancelled.', true);
END; $$;

-- 6. resolve_dispute — ledger-only settlement
CREATE OR REPLACE FUNCTION public.resolve_dispute(
  _trade_id uuid, _caller uuid, _award_to text, _note text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v trades%rowtype; v_total_sats bigint; v_fee_sats bigint; v_net_sats bigint;
BEGIN
  IF NOT public.is_staff(_caller) THEN RAISE EXCEPTION 'Only staff can resolve'; END IF;
  SELECT * INTO v FROM trades WHERE id = _trade_id FOR UPDATE;
  IF v.status <> 'disputed' THEN RAISE EXCEPTION 'Trade not disputed'; END IF;
  v_total_sats := floor(v.crypto_amount * 100000000)::bigint;
  v_fee_sats   := floor(v.fee_amount    * 100000000)::bigint;
  v_net_sats   := v_total_sats - v_fee_sats;

  IF _award_to = 'seller' THEN
    PERFORM public.ledger_debit(v.buyer_id, 'locked_escrow'::ledger_bucket, v_total_sats,
      'dispute_resolution'::ledger_kind, 'trade', _trade_id, jsonb_build_object('award_to','seller'));
    IF v_net_sats > 0 THEN
      PERFORM public.ledger_credit(v.seller_id, 'available'::ledger_bucket, v_net_sats,
        'dispute_resolution'::ledger_kind, 'trade', _trade_id, jsonb_build_object('award_to','seller'));
    END IF;
    IF v_fee_sats > 0 THEN
      INSERT INTO public.platform_fees (trade_id, fee_sats, source, metadata)
      VALUES (_trade_id, v_fee_sats, 'dispute_resolution',
        jsonb_build_object('award_to','seller','buyer_id',v.buyer_id,'seller_id',v.seller_id));
    END IF;
    UPDATE trades SET status='released', released_at=now() WHERE id=_trade_id;
    UPDATE disputes SET status='resolved_seller', resolved_by=_caller, resolution_note=_note, resolved_at=now() WHERE trade_id=_trade_id;
  ELSIF _award_to = 'buyer' THEN
    PERFORM public.ledger_transfer_bucket(v.buyer_id,
      'locked_escrow'::ledger_bucket, 'available'::ledger_bucket,
      v_total_sats, 'dispute_resolution'::ledger_kind, 'trade', _trade_id,
      jsonb_build_object('award_to','buyer'));
    UPDATE offers SET available_crypto = available_crypto + v.crypto_amount WHERE id = v.offer_id;
    UPDATE trades SET status='cancelled', cancelled_at=now() WHERE id=_trade_id;
    UPDATE disputes SET status='resolved_buyer', resolved_by=_caller, resolution_note=_note, resolved_at=now() WHERE trade_id=_trade_id;
  ELSE
    RAISE EXCEPTION 'award_to must be buyer or seller';
  END IF;

  INSERT INTO trade_messages(trade_id, sender_id, body, is_system)
    VALUES (_trade_id, _caller, 'Dispute resolved in favor of '||_award_to||'. '||COALESCE(_note,''), true);
END; $$;

-- 7. Lock down legacy tables (reads still allowed for historical view)
REVOKE INSERT, UPDATE, DELETE ON public.wallets             FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.wallet_transactions FROM authenticated, anon;
GRANT ALL ON public.wallets             TO service_role;
GRANT ALL ON public.wallet_transactions TO service_role;

COMMENT ON TABLE public.wallets IS
  'LEGACY — historical reference only. New balances live in user_wallets / ledger_entries / v_wallet_balances.';
COMMENT ON TABLE public.wallet_transactions IS
  'LEGACY — historical reference only. New movements live in ledger_entries.';
