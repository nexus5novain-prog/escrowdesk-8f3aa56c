CREATE OR REPLACE FUNCTION public.buy_listing(
  _listing_id uuid,
  _buyer uuid,
  _btc_rate numeric
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing listings%rowtype;
  v_offer_id uuid;
  v_trade_id uuid;
  v_crypto numeric(24,8);
  v_banned boolean;
  v_currency text;
  v_fiat numeric;
BEGIN
  IF _btc_rate IS NULL OR _btc_rate <= 0 THEN RAISE EXCEPTION 'Invalid BTC rate'; END IF;

  SELECT * INTO v_listing FROM listings WHERE id = _listing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF v_listing.status <> 'active' THEN RAISE EXCEPTION 'Listing unavailable'; END IF;
  IF v_listing.kind <> 'selling' THEN RAISE EXCEPTION 'Only selling listings can be bought'; END IF;
  IF v_listing.user_id = _buyer THEN RAISE EXCEPTION 'Cannot trade your own listing'; END IF;
  IF v_listing.amount IS NULL OR v_listing.amount <= 0 THEN RAISE EXCEPTION 'Listing has no price'; END IF;

  SELECT is_banned INTO v_banned FROM profiles WHERE user_id = _buyer;
  IF v_banned THEN RAISE EXCEPTION 'Account is banned'; END IF;

  v_currency := COALESCE(NULLIF(v_listing.currency, ''), 'USD');
  v_fiat := v_listing.amount::numeric;
  v_crypto := round(v_fiat / _btc_rate, 8);
  IF v_crypto <= 0 THEN RAISE EXCEPTION 'Computed crypto amount is zero'; END IF;

  INSERT INTO offers(
    maker_id, side, asset, fiat_currency, price,
    min_amount, max_amount, available_crypto,
    payment_method_types, terms, status
  ) VALUES (
    v_listing.user_id, 'sell', 'BTC', v_currency, _btc_rate,
    v_fiat, v_fiat, v_crypto,
    ARRAY['order_book']::text[],
    'Order-book trade: ' || v_listing.name,
    'active'
  ) RETURNING id INTO v_offer_id;

  v_trade_id := public.start_trade(v_offer_id, _buyer, v_fiat, NULL);

  UPDATE offers SET status = 'closed' WHERE id = v_offer_id;

  RETURN v_trade_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.buy_listing(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;