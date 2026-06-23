
-- Add is_seeded flag to mark demo products in admin
ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS is_seeded boolean NOT NULL DEFAULT false;

-- Seed real BIN reference data (no card numbers — just bank/brand/type/country per 6-digit BIN)
INSERT INTO public.bin_metadata (bin_number, card_brand, card_type, card_bank, card_country, card_address, description)
VALUES
  ('414720','Visa','Credit','Chase Bank USA','US',NULL,'Chase Sapphire'),
  ('424631','Visa','Credit','Bank of America','US',NULL,'BofA Visa'),
  ('438857','Visa','Debit','Wells Fargo','US',NULL,'Wells Fargo Debit'),
  ('400022','Visa','Credit','Citibank','US',NULL,'Citi Visa'),
  ('453998','Visa','Credit','Capital One','US',NULL,'Capital One Venture'),
  ('446542','Visa','Debit','U.S. Bank','US',NULL,'US Bank Visa Debit'),
  ('465859','Visa','Credit','Barclays Bank','GB',NULL,'Barclays Visa'),
  ('492181','Visa','Debit','Lloyds Bank','GB',NULL,'Lloyds Debit'),
  ('450875','Visa','Credit','HSBC','GB',NULL,'HSBC Premier'),
  ('455673','Visa','Credit','TD Canada Trust','CA',NULL,'TD Visa Infinite'),
  ('545616','Mastercard','Credit','Chase Bank USA','US',NULL,'Chase Freedom Mastercard'),
  ('540211','Mastercard','Debit','Bank of America','US',NULL,'BofA Debit MC'),
  ('524366','Mastercard','Credit','Capital One','US',NULL,'Capital One Quicksilver'),
  ('552433','Mastercard','Credit','Citibank','US',NULL,'Citi Double Cash'),
  ('535316','Mastercard','Credit','Barclays Bank','GB',NULL,'Barclaycard Platinum'),
  ('516259','Mastercard','Debit','Santander','ES',NULL,'Santander Debit'),
  ('555555','Mastercard','Credit','Deutsche Bank','DE',NULL,'Deutsche Bank MC'),
  ('510510','Mastercard','Credit','BMO Bank of Montreal','CA',NULL,'BMO World Elite'),
  ('371449','American Express','Credit','American Express','US',NULL,'Amex Gold'),
  ('378282','American Express','Credit','American Express','US',NULL,'Amex Platinum'),
  ('374245','American Express','Credit','American Express','GB',NULL,'Amex Preferred Rewards'),
  ('601100','Discover','Credit','Discover Bank','US',NULL,'Discover it'),
  ('650000','Discover','Debit','Discover Bank','US',NULL,'Discover Cashback Debit'),
  ('353011','JCB','Credit','JCB Co.','JP',NULL,'JCB Original Series'),
  ('356600','JCB','Credit','JCB Co.','JP',NULL,'JCB Gold'),
  ('622202','UnionPay','Debit','Bank of China','CN',NULL,'BOC UnionPay'),
  ('622826','UnionPay','Credit','ICBC','CN',NULL,'ICBC Platinum'),
  ('478819','Visa','Credit','ANZ Bank','AU',NULL,'ANZ Rewards'),
  ('456472','Visa','Debit','Commonwealth Bank','AU',NULL,'CBA Debit'),
  ('521729','Mastercard','Credit','Westpac','AU',NULL,'Westpac Altitude')
ON CONFLICT (bin_number) DO UPDATE SET
  card_brand = EXCLUDED.card_brand,
  card_type = EXCLUDED.card_type,
  card_bank = EXCLUDED.card_bank,
  card_country = EXCLUDED.card_country,
  description = EXCLUDED.description;
