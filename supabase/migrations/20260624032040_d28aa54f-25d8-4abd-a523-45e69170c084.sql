CREATE OR REPLACE FUNCTION public.buy_marketplace_product(
  _product_id uuid,
  _buyer uuid,
  _btc_rate numeric
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product marketplace_products%rowtype;
  v_offer_id uuid;
  v_trade_id uuid;
  v_crypto numeric(24,8);
  v_banned boolean;
BEGIN
  IF _btc_rate IS NULL OR _btc_rate <= 0 THEN
    RAISE EXCEPTION 'Invalid BTC rate';
  END IF;

  SELECT * INTO v_product FROM marketplace_products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF v_product.status <> 'active' THEN RAISE EXCEPTION 'Product unavailable'; END IF;
  IF v_product.created_by = _buyer THEN RAISE EXCEPTION 'Cannot buy your own product'; END IF;
  IF v_product.stock IS NOT NULL AND v_product.stock <= 0 THEN
    RAISE EXCEPTION 'Out of stock';
  END IF;

  SELECT is_banned INTO v_banned FROM profiles WHERE user_id = _buyer;
  IF v_banned THEN RAISE EXCEPTION 'Account is banned'; END IF;

  v_crypto := round(v_product.price::numeric / _btc_rate, 8);
  IF v_crypto <= 0 THEN RAISE EXCEPTION 'Computed crypto amount is zero'; END IF;

  -- Mint a one-shot internal offer owned by the seller. The seller is the
  -- "maker" selling BTC-equivalent for the product's fiat price. start_trade
  -- will lock the buyer's available BTC into escrow.
  INSERT INTO offers(
    maker_id, side, asset, fiat_currency, price,
    min_amount, max_amount, available_crypto,
    payment_method_types, terms, status
  ) VALUES (
    v_product.created_by, 'sell', 'BTC', v_product.fiat_currency_or_default(v_product.currency), _btc_rate,
    v_product.price, v_product.price, v_crypto,
    ARRAY['marketplace']::text[],
    'Marketplace purchase: ' || v_product.name,
    'active'
  ) RETURNING id INTO v_offer_id;

  v_trade_id := public.start_trade(v_offer_id, _buyer, v_product.price, NULL);

  -- Close the one-shot offer immediately so it never appears in the order book.
  UPDATE offers SET status = 'closed' WHERE id = v_offer_id;

  -- Decrement stock; flip to sold_out when depleted.
  IF v_product.stock IS NOT NULL THEN
    UPDATE marketplace_products
       SET stock = GREATEST(stock - 1, 0),
           status = CASE WHEN stock - 1 <= 0 THEN 'sold_out' ELSE status END
     WHERE id = _product_id;
  END IF;

  RETURN v_trade_id;
END; $$;

-- Helper: marketplace_products may have null currency rows; default to USD.
-- (Inline expression alternative since we can't add a method to a rowtype.)
CREATE OR REPLACE FUNCTION public.marketplace_products_fiat_currency_or_default(_currency text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(NULLIF(_currency, ''), 'USD')
$$;

-- Rewrite buy_marketplace_product to use the helper (replaces the broken
-- v_product.fiat_currency_or_default reference above).
CREATE OR REPLACE FUNCTION public.buy_marketplace_product(
  _product_id uuid,
  _buyer uuid,
  _btc_rate numeric
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product marketplace_products%rowtype;
  v_offer_id uuid;
  v_trade_id uuid;
  v_crypto numeric(24,8);
  v_banned boolean;
  v_currency text;
BEGIN
  IF _btc_rate IS NULL OR _btc_rate <= 0 THEN
    RAISE EXCEPTION 'Invalid BTC rate';
  END IF;

  SELECT * INTO v_product FROM marketplace_products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF v_product.status <> 'active' THEN RAISE EXCEPTION 'Product unavailable'; END IF;
  IF v_product.created_by = _buyer THEN RAISE EXCEPTION 'Cannot buy your own product'; END IF;
  IF v_product.stock IS NOT NULL AND v_product.stock <= 0 THEN
    RAISE EXCEPTION 'Out of stock';
  END IF;

  SELECT is_banned INTO v_banned FROM profiles WHERE user_id = _buyer;
  IF v_banned THEN RAISE EXCEPTION 'Account is banned'; END IF;

  v_currency := COALESCE(NULLIF(v_product.currency, ''), 'USD');
  v_crypto := round(v_product.price::numeric / _btc_rate, 8);
  IF v_crypto <= 0 THEN RAISE EXCEPTION 'Computed crypto amount is zero'; END IF;

  INSERT INTO offers(
    maker_id, side, asset, fiat_currency, price,
    min_amount, max_amount, available_crypto,
    payment_method_types, terms, status
  ) VALUES (
    v_product.created_by, 'sell', 'BTC', v_currency, _btc_rate,
    v_product.price, v_product.price, v_crypto,
    ARRAY['marketplace']::text[],
    'Marketplace purchase: ' || v_product.name,
    'active'
  ) RETURNING id INTO v_offer_id;

  v_trade_id := public.start_trade(v_offer_id, _buyer, v_product.price, NULL);

  UPDATE offers SET status = 'closed' WHERE id = v_offer_id;

  IF v_product.stock IS NOT NULL THEN
    UPDATE marketplace_products
       SET stock = GREATEST(stock - 1, 0),
           status = CASE WHEN stock - 1 <= 0 THEN 'sold_out' ELSE status END
     WHERE id = _product_id;
  END IF;

  RETURN v_trade_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.buy_marketplace_product(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.marketplace_products_fiat_currency_or_default(text) FROM PUBLIC, anon, authenticated;