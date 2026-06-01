DO $$
DECLARE
  admin_id UUID;
  wh_id    UUID := '00000000-0000-0000-0000-000000000001';
  loc1     UUID;
  loc2     UUID;
  loc3     UUID;
  loc4     UUID;
  p1       UUID := '10000000-0000-0000-0000-000000000001';
  p2       UUID := '10000000-0000-0000-0000-000000000002';
  p3       UUID := '10000000-0000-0000-0000-000000000003';
  p4       UUID := '10000000-0000-0000-0000-000000000004';
  p5       UUID := '10000000-0000-0000-0000-000000000005';
BEGIN
  SELECT id INTO admin_id FROM users WHERE username = 'admin';
  SELECT id INTO loc1 FROM locations WHERE code = 'A-01-01-01';
  SELECT id INTO loc2 FROM locations WHERE code = 'A-01-01-02';
  SELECT id INTO loc3 FROM locations WHERE code = 'A-01-02-01';
  SELECT id INTO loc4 FROM locations WHERE code = 'A-01-02-02';

  -- 샘플 상품 5종
  INSERT INTO products (id, code, name, category, brand, unit, box_qty, safety_stock, reorder_point, cost_price, sell_price, sale_status, created_by)
  VALUES
    (p1, 'P-001', '코카콜라 1.5L',      '음료', '코카콜라',   'EA', 12, 50,  100, 800,  1500, 'ACTIVE', admin_id),
    (p2, 'P-002', '포카리스웨트 500ml', '음료', '동아오츠카', 'EA', 24, 100, 200, 600,  1200, 'ACTIVE', admin_id),
    (p3, 'P-003', '신라면 5개입',        '식품', '농심',       'EA',  8, 30,   60, 2500, 4500, 'ACTIVE', admin_id),
    (p4, 'P-004', '삼다수 2L',           '생수', '광동제약',   'EA',  6, 80,  150, 500,   900, 'ACTIVE', admin_id),
    (p5, 'P-005', '초코파이 12개입',     '과자', '오리온',     'EA', 10, 20,   40, 3500, 6000, 'ACTIVE', admin_id)
  ON CONFLICT (code) DO NOTHING;

  -- 바코드
  INSERT INTO barcodes (product_id, barcode, type, unit_qty, is_primary)
  VALUES
    (p1, '8801043011082', 'UNIT', 1,  true),
    (p1, '8801043011099', 'BOX',  12, false),
    (p2, '8801054580054', 'UNIT', 1,  true),
    (p3, '8801043053212', 'UNIT', 1,  true),
    (p3, '8801043053229', 'BOX',  8,  false),
    (p4, '8809338500018', 'UNIT', 1,  true),
    (p5, '8801117160152', 'UNIT', 1,  true)
  ON CONFLICT (barcode) DO NOTHING;

  -- 현재 재고 (최종 상태)
  INSERT INTO inventory (product_id, location_id, warehouse_id, quantity, reserved_qty, last_synced_at)
  VALUES
    (p1, loc1, wh_id, 120, 0, now()),
    (p2, loc1, wh_id,  85, 0, now()),
    (p3, loc2, wh_id,  40, 0, now()),
    (p4, loc3, wh_id, 200, 0, now()),
    (p5, loc4, wh_id,  15, 0, now());

  -- 지난 7일 재고 이력
  INSERT INTO stock_transactions
    (txn_no, product_id, location_id, warehouse_id, qty, qty_before, qty_after, tx_type, created_by, created_at)
  VALUES
    ('TXN-'||to_char(now()-'6 days'::interval,'YYYYMMDD')||'-'||lpad(nextval('txn_seq')::text,6,'0'),
     p1, loc1, wh_id,  200,   0, 200, 'INBOUND',  admin_id, now()-'6 days'::interval),
    ('TXN-'||to_char(now()-'5 days'::interval,'YYYYMMDD')||'-'||lpad(nextval('txn_seq')::text,6,'0'),
     p2, loc1, wh_id,  150,   0, 150, 'INBOUND',  admin_id, now()-'5 days'::interval),
    ('TXN-'||to_char(now()-'5 days'::interval,'YYYYMMDD')||'-'||lpad(nextval('txn_seq')::text,6,'0'),
     p1, loc1, wh_id,  -30, 200, 170, 'OUTBOUND', admin_id, now()-'5 days'::interval+'2 hours'::interval),
    ('TXN-'||to_char(now()-'4 days'::interval,'YYYYMMDD')||'-'||lpad(nextval('txn_seq')::text,6,'0'),
     p3, loc2, wh_id,   80,   0,  80, 'INBOUND',  admin_id, now()-'4 days'::interval),
    ('TXN-'||to_char(now()-'4 days'::interval,'YYYYMMDD')||'-'||lpad(nextval('txn_seq')::text,6,'0'),
     p2, loc1, wh_id,  -20, 150, 130, 'OUTBOUND', admin_id, now()-'4 days'::interval+'3 hours'::interval),
    ('TXN-'||to_char(now()-'3 days'::interval,'YYYYMMDD')||'-'||lpad(nextval('txn_seq')::text,6,'0'),
     p4, loc3, wh_id,  300,   0, 300, 'INBOUND',  admin_id, now()-'3 days'::interval),
    ('TXN-'||to_char(now()-'3 days'::interval,'YYYYMMDD')||'-'||lpad(nextval('txn_seq')::text,6,'0'),
     p1, loc1, wh_id,  -50, 170, 120, 'OUTBOUND', admin_id, now()-'3 days'::interval+'4 hours'::interval),
    ('TXN-'||to_char(now()-'2 days'::interval,'YYYYMMDD')||'-'||lpad(nextval('txn_seq')::text,6,'0'),
     p5, loc4, wh_id,   60,   0,  60, 'INBOUND',  admin_id, now()-'2 days'::interval),
    ('TXN-'||to_char(now()-'2 days'::interval,'YYYYMMDD')||'-'||lpad(nextval('txn_seq')::text,6,'0'),
     p3, loc2, wh_id,  -40,  80,  40, 'OUTBOUND', admin_id, now()-'2 days'::interval+'2 hours'::interval),
    ('TXN-'||to_char(now()-'1 day'::interval, 'YYYYMMDD')||'-'||lpad(nextval('txn_seq')::text,6,'0'),
     p4, loc3, wh_id, -100, 300, 200, 'OUTBOUND', admin_id, now()-'1 day'::interval),
    ('TXN-'||to_char(now()-'1 day'::interval, 'YYYYMMDD')||'-'||lpad(nextval('txn_seq')::text,6,'0'),
     p2, loc1, wh_id,  -45, 130,  85, 'OUTBOUND', admin_id, now()-'1 day'::interval+'3 hours'::interval),
    ('TXN-'||to_char(now(),'YYYYMMDD')                   ||'-'||lpad(nextval('txn_seq')::text,6,'0'),
     p5, loc4, wh_id,  -45,  60,  15, 'OUTBOUND', admin_id, now()-'2 hours'::interval);
END $$;
