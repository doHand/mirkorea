-- P-001~P-005 상품의 UNIT 바코드가 누락된 경우 삽입합니다.
-- V46에서 BOX→CXD_BOX 전환 시 기존 BOX 데이터가 없어진 경우를 보완합니다.

DO $$
DECLARE
  p1 UUID := '10000000-0000-0000-0000-000000000001';
  p2 UUID := '10000000-0000-0000-0000-000000000002';
  p3 UUID := '10000000-0000-0000-0000-000000000003';
  p4 UUID := '10000000-0000-0000-0000-000000000004';
  p5 UUID := '10000000-0000-0000-0000-000000000005';
BEGIN
  INSERT INTO barcodes (product_id, product_code, barcode, type, unit_qty, is_primary)
  VALUES
    (p1, 'P-001', '8801043011082', 'UNIT', 1, true),
    (p1, 'P-001', '8801043011099', 'CXD_BOX', 10, false),
    (p2, 'P-002', '8801054580054', 'UNIT', 1, true),
    (p3, 'P-003', '8801043053212', 'UNIT', 1, true),
    (p3, 'P-003', '8801043053229', 'CXD_BOX', 8, false),
    (p4, 'P-004', '8809338500018', 'UNIT', 1, true),
    (p5, 'P-005', '8801117160152', 'UNIT', 1, true)
  ON CONFLICT (barcode) DO NOTHING;
END $$;
