-- 기존 5개 샘플 상품에 UNIT·CXD·CXD_BOX 바코드를 모두 채웁니다.
-- 이미 존재하는 바코드는 건너뜁니다(ON CONFLICT DO NOTHING).
-- 29 대역(내부 용도)을 사용합니다.

DO $$
DECLARE
  p1 UUID := '10000000-0000-0000-0000-000000000001'; -- P-001 코카콜라 1.5L  box_qty=12
  p2 UUID := '10000000-0000-0000-0000-000000000002'; -- P-002 포카리스웨트    box_qty=24
  p3 UUID := '10000000-0000-0000-0000-000000000003'; -- P-003 신라면 5개입    box_qty=8
  p4 UUID := '10000000-0000-0000-0000-000000000004'; -- P-004 삼다수 2L       box_qty=6
  p5 UUID := '10000000-0000-0000-0000-000000000005'; -- P-005 초코파이 12개입 box_qty=10
BEGIN
  -- P-001: UNIT 기존(8801043011082), CXD_BOX 기존(8801043011099→CXD_BOX)
  --        CXD 추가
  INSERT INTO barcodes (product_id, product_code, barcode, type, unit_qty, is_primary)
  VALUES (p1, 'P-001', '2901001000027', 'CXD', 6, false)
  ON CONFLICT (barcode) DO NOTHING;

  -- P-002: UNIT 기존(8801054580054)
  --        CXD, CXD_BOX 추가
  INSERT INTO barcodes (product_id, product_code, barcode, type, unit_qty, is_primary)
  VALUES
    (p2, 'P-002', '2901002000026', 'CXD',     12, false),
    (p2, 'P-002', '2901002000033', 'CXD_BOX', 24, false)
  ON CONFLICT (barcode) DO NOTHING;

  -- P-003: UNIT 기존(8801043053212), CXD_BOX 기존(8801043053229→CXD_BOX)
  --        CXD 추가
  INSERT INTO barcodes (product_id, product_code, barcode, type, unit_qty, is_primary)
  VALUES (p3, 'P-003', '2901003000025', 'CXD', 4, false)
  ON CONFLICT (barcode) DO NOTHING;

  -- P-004: UNIT 기존(8809338500018)
  --        CXD, CXD_BOX 추가
  INSERT INTO barcodes (product_id, product_code, barcode, type, unit_qty, is_primary)
  VALUES
    (p4, 'P-004', '2901004000024', 'CXD',     3, false),
    (p4, 'P-004', '2901004000031', 'CXD_BOX', 6, false)
  ON CONFLICT (barcode) DO NOTHING;

  -- P-005: UNIT 기존(8801117160152)
  --        CXD, CXD_BOX 추가
  INSERT INTO barcodes (product_id, product_code, barcode, type, unit_qty, is_primary)
  VALUES
    (p5, 'P-005', '2901005000023', 'CXD',     5,  false),
    (p5, 'P-005', '2901005000030', 'CXD_BOX', 10, false)
  ON CONFLICT (barcode) DO NOTHING;
END $$;
