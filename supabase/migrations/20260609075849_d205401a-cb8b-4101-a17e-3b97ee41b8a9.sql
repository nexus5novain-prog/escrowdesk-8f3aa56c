ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'judge';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';
ALTER TYPE public.asset_type ADD VALUE IF NOT EXISTS 'USDC';
ALTER TYPE public.asset_type ADD VALUE IF NOT EXISTS 'ETH';
ALTER TYPE public.trade_status ADD VALUE IF NOT EXISTS 'awaiting_agreement';
ALTER TYPE public.trade_status ADD VALUE IF NOT EXISTS 'awaiting_deposit';
ALTER TYPE public.trade_status ADD VALUE IF NOT EXISTS 'awaiting_seller_confirm';