-- Backfill sample product metadata used by the product grid.
DO $$
DECLARE
  client_beverage UUID;
  client_food     UUID;
  client_daily    UUID;
  loc_a010101     UUID;
  loc_a010102     UUID;
  loc_a010201     UUID;
  loc_a010202     UUID;
  loc_a020101     UUID;
BEGIN
  INSERT INTO clients (name, business_no, address, industry, sector, email, phone, manager_name, manager_title, is_active)
  VALUES
    ('MK Beverage', '101-81-10001', 'Seoul Jung-gu', 'Distribution', 'Beverage', 'beverage@mk-wms.local', '02-1000-1001', 'Kim Minjun', 'Sales Manager', true),
    ('Hansol Foods', '202-82-20002', 'Gyeonggi Seongnam', 'Food', 'Grocery', 'foods@mk-wms.local', '031-2000-2002', 'Lee Seoyeon', 'Account Manager', true),
    ('Jeju Daily Supply', '303-83-30003', 'Jeju Jeju-si', 'Distribution', 'Daily Goods', 'daily@mk-wms.local', '064-3000-3003', 'Park Jihoon', 'Sales Lead', true)
  ON CONFLICT DO NOTHING;

  SELECT id INTO client_beverage FROM clients WHERE name = 'MK Beverage' LIMIT 1;
  SELECT id INTO client_food     FROM clients WHERE name = 'Hansol Foods' LIMIT 1;
  SELECT id INTO client_daily    FROM clients WHERE name = 'Jeju Daily Supply' LIMIT 1;

  SELECT id INTO loc_a010101 FROM locations WHERE code = 'A-01-01-01' LIMIT 1;
  SELECT id INTO loc_a010102 FROM locations WHERE code = 'A-01-01-02' LIMIT 1;
  SELECT id INTO loc_a010201 FROM locations WHERE code = 'A-01-02-01' LIMIT 1;
  SELECT id INTO loc_a010202 FROM locations WHERE code = 'A-01-02-02' LIMIT 1;
  SELECT id INTO loc_a020101 FROM locations WHERE code = 'A-02-01-01' LIMIT 1;

  UPDATE products
  SET client_id = client_beverage,
      location_id = loc_a010101,
      material_no = 'MAT-BEV-001',
      option_name = '1.5L',
      spec = '12EA/BOX',
      price_a = 1450,
      price_b = 1420,
      price_c = 1380,
      retail_price = 1800,
      memo = 'Fast-moving beverage SKU'
  WHERE code = 'P-001';

  UPDATE products
  SET client_id = client_beverage,
      location_id = loc_a010102,
      material_no = 'MAT-BEV-002',
      option_name = '500ml',
      spec = '24EA/BOX',
      price_a = 1160,
      price_b = 1120,
      price_c = 1080,
      retail_price = 1500,
      memo = 'Keep in beverage picking zone'
  WHERE code = 'P-002';

  UPDATE products
  SET client_id = client_food,
      location_id = loc_a010201,
      material_no = 'MAT-FOD-003',
      option_name = '5 pack',
      spec = '8EA/BOX',
      price_a = 4300,
      price_b = 4150,
      price_c = 3980,
      retail_price = 5200,
      memo = 'Bundle pack for grocery orders'
  WHERE code = 'P-003';

  UPDATE products
  SET client_id = client_daily,
      location_id = loc_a010202,
      material_no = 'MAT-WTR-004',
      option_name = '2L',
      spec = '6EA/BOX',
      price_a = 870,
      price_b = 840,
      price_c = 810,
      retail_price = 1200,
      memo = 'Heavy item, store low shelf'
  WHERE code = 'P-004';

  UPDATE products
  SET client_id = client_food,
      location_id = loc_a020101,
      material_no = 'MAT-SNK-005',
      option_name = '12 pack',
      spec = '10EA/BOX',
      price_a = 5800,
      price_b = 5600,
      price_c = 5400,
      retail_price = 7200,
      memo = 'Snack promo item'
  WHERE code = 'P-005';
END $$;
