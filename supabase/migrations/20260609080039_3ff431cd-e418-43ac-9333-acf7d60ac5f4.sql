
-- Fee ladder helper
CREATE OR REPLACE FUNCTION public.compute_fee_bps(_fiat_amount numeric)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE tier jsonb; tiers jsonb;
BEGIN
  SELECT value INTO tiers FROM platform_settings WHERE key = 'fee_tiers';
  IF tiers IS NULL THEN
    RETURN COALESCE((SELECT (value)::int FROM platform_settings WHERE key='fee_bps'), 200);
  END IF;
  FOR tier IN SELECT * FROM jsonb_array_elements(tiers) LOOP
    IF tier->>'max' IS NULL OR _fiat_amount < (tier->>'max')::numeric THEN
      RETURN (tier->>'bps')::int;
    END IF;
  END LOOP;
  RETURN 1000;
END; $$;

-- sign_terms
CREATE OR REPLACE FUNCTION public.sign_terms(_trade_id uuid, _caller uuid, _signature text, _terms text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v trades%rowtype; v_side text; v_required_phrase text; v_norm text;
BEGIN
  SELECT * INTO v FROM trades WHERE id = _trade_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trade not found'; END IF;
  IF v.status NOT IN ('awaiting_agreement','pending_payment') THEN
    RAISE EXCEPTION 'Trade not awaiting agreement';
  END IF;
  IF v.buyer_id = _caller THEN
    v_side := 'buyer'; v_required_phrase := 'I AGREE TO TERMS AND CONDITIONS OF THE SELLER';
  ELSIF v.seller_id = _caller THEN
    v_side := 'seller'; v_required_phrase := 'I AGREE TO TERMS AND CONDITIONS OF THE BUYER';
  ELSE RAISE EXCEPTION 'Not a participant'; END IF;
  v_norm := upper(btrim(_signature));
  IF v_norm <> v_required_phrase THEN
    RAISE EXCEPTION 'Signature must be exactly: %', v_required_phrase;
  END IF;
  IF v_side = 'buyer' THEN
    UPDATE trades SET signature_buyer=_signature, signed_by_buyer_at=now(),
      terms_buyer=COALESCE(_terms, terms_buyer) WHERE id=_trade_id;
  ELSE
    UPDATE trades SET signature_seller=_signature, signed_by_seller_at=now(),
      terms_seller=COALESCE(_terms, terms_seller) WHERE id=_trade_id;
  END IF;
  INSERT INTO trade_messages(trade_id, sender_id, body, is_system)
  VALUES (_trade_id, _caller, v_side || ' signed terms.', true);
  SELECT * INTO v FROM trades WHERE id=_trade_id;
  IF v.signed_by_buyer_at IS NOT NULL AND v.signed_by_seller_at IS NOT NULL AND v.status='awaiting_agreement' THEN
    UPDATE trades SET status='awaiting_seller_confirm' WHERE id=_trade_id;
    INSERT INTO trade_messages(trade_id, sender_id, body, is_system)
    VALUES (_trade_id, _caller, 'Both parties signed. Seller, please confirm escrow deposit.', true);
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.confirm_buyer_deposit(_trade_id uuid, _caller uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v trades%rowtype;
BEGIN
  SELECT * INTO v FROM trades WHERE id=_trade_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trade not found'; END IF;
  IF v.seller_id <> _caller THEN RAISE EXCEPTION 'Only seller can confirm deposit'; END IF;
  IF v.status <> 'awaiting_seller_confirm' THEN RAISE EXCEPTION 'Trade not in deposit-confirm step'; END IF;
  UPDATE trades SET status='paid', deposit_confirmed_at=now(), paid_at=now() WHERE id=_trade_id;
  INSERT INTO trade_messages(trade_id, sender_id, body, is_system)
  VALUES (_trade_id, _caller, 'Seller confirmed escrow deposit. Buyer must release after fiat settles.', true);
END; $$;

CREATE OR REPLACE FUNCTION public.warn_user(_target uuid, _caller uuid, _reason text, _severity text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT (has_role(_caller,'admin') OR has_role(_caller,'moderator') OR has_role(_caller,'judge')) THEN
    RAISE EXCEPTION 'Not authorized to warn users';
  END IF;
  IF _severity NOT IN ('minor','major','final') THEN
    RAISE EXCEPTION 'Invalid severity (minor|major|final)';
  END IF;
  INSERT INTO user_warnings(user_id, issued_by, reason, severity)
    VALUES (_target, _caller, _reason, _severity) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.ban_user(_target uuid, _caller uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (has_role(_caller,'admin') OR has_role(_caller,'moderator')) THEN
    RAISE EXCEPTION 'Not authorized to ban users';
  END IF;
  UPDATE profiles SET is_banned=true, ban_reason=_reason, banned_at=now(), banned_by=_caller WHERE user_id=_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.unban_user(_target uuid, _caller uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(_caller,'admin') THEN RAISE EXCEPTION 'Only admins can unban'; END IF;
  UPDATE profiles SET is_banned=false, ban_reason=NULL, banned_at=NULL, banned_by=NULL WHERE user_id=_target;
END; $$;

CREATE OR REPLACE FUNCTION public.assign_role(_target uuid, _caller uuid, _role app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(_caller,'admin') THEN RAISE EXCEPTION 'Only admins can assign roles'; END IF;
  INSERT INTO user_roles(user_id, role) VALUES (_target, _role) ON CONFLICT (user_id, role) DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.revoke_role(_target uuid, _caller uuid, _role app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(_caller,'admin') THEN RAISE EXCEPTION 'Only admins can revoke roles'; END IF;
  DELETE FROM user_roles WHERE user_id=_target AND role=_role;
END; $$;

-- Lock down direct Data API access — these are called only via SECURITY DEFINER server functions
REVOKE EXECUTE ON FUNCTION public.compute_fee_bps(numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sign_terms(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_buyer_deposit(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.warn_user(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ban_user(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unban_user(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_role(uuid, uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_role(uuid, uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon, authenticated;
