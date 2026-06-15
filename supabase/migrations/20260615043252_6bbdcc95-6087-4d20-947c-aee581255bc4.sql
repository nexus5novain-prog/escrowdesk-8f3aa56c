-- Rename existing marketplace categories to new canonical values
UPDATE public.marketplace_products SET category = 'BIN/CC' WHERE category = 'BIN';
UPDATE public.marketplace_products SET category = 'ENROLL' WHERE category IN ('Enroll','enroll');
UPDATE public.marketplace_products SET category = 'SCANNER' WHERE category IN ('Scanner','scanner');
UPDATE public.marketplace_products SET category = 'COMBO' WHERE category IN ('Combo','combo');
-- Anything not in the new set becomes OTHERS
UPDATE public.marketplace_products
  SET category = 'OTHERS'
  WHERE category NOT IN ('BIN/CC','ENROLL','SCANNER','COMBO','OTHERS');

-- Mirror in escrow_groups.listing_category for consistent display
UPDATE public.escrow_groups SET listing_category = 'BIN/CC' WHERE listing_category = 'BIN';
UPDATE public.escrow_groups SET listing_category = 'ENROLL' WHERE listing_category IN ('Enroll','enroll');
UPDATE public.escrow_groups SET listing_category = 'SCANNER' WHERE listing_category IN ('Scanner','scanner');
UPDATE public.escrow_groups SET listing_category = 'COMBO' WHERE listing_category IN ('Combo','combo');
