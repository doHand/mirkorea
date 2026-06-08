DO $$
DECLARE
  admin_id UUID;
  wh_id UUID;
  receiving_location_id UUID;
  storage_location_id UUID;
  pending_order_id UUID := '20000000-0000-0000-0000-000000000001';
  receiving_order_id UUID := '20000000-0000-0000-0000-000000000002';
  inspecting_order_id UUID := '20000000-0000-0000-0000-000000000003';
BEGIN
  SELECT id INTO admin_id FROM users WHERE username = 'admin' LIMIT 1;
  SELECT id INTO wh_id FROM warehouses WHERE code = 'WH-001' LIMIT 1;
  SELECT id INTO receiving_location_id FROM locations WHERE code = 'IN-STAGE-01' LIMIT 1;
  SELECT id INTO storage_location_id FROM locations WHERE code = 'A-01-01-01' LIMIT 1;

  IF admin_id IS NULL OR wh_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO inbound_orders
    (id, order_no, warehouse_id, supplier, expected_date, status, memo, created_by, created_at, updated_at)
  VALUES
    (pending_order_id, 'IB-SAMPLE-001', wh_id, '샘플 공급업체 A', CURRENT_DATE + 2, 'PENDING',
     '입고 예정 상태 테스트 데이터', admin_id, now() - interval '2 hours', now() - interval '2 hours'),
    (receiving_order_id, 'IB-SAMPLE-002', wh_id, '샘플 공급업체 B', CURRENT_DATE, 'RECEIVING',
     '수령 처리 화면 테스트 데이터', admin_id, now() - interval '1 day', now() - interval '1 hour'),
    (inspecting_order_id, 'IB-SAMPLE-003', wh_id, '샘플 공급업체 C', CURRENT_DATE - 1, 'INSPECTING',
     '검수 및 입고 완료 테스트 데이터', admin_id, now() - interval '2 days', now() - interval '30 minutes')
  ON CONFLICT (order_no) DO NOTHING;

  INSERT INTO inbound_order_items
    (order_id, product_id, expected_qty, received_qty, passed_qty, defect_qty, lot_number, expire_date, location_id, note)
  SELECT pending_order_id, p.id, 48, 0, 0, 0, 'SAMPLE-A-001', CURRENT_DATE + 180, receiving_location_id, '미수령 예시'
  FROM products p
  WHERE p.code = 'P-001' AND EXISTS (SELECT 1 FROM inbound_orders WHERE id = pending_order_id)
  UNION ALL
  SELECT pending_order_id, p.id, 30, 0, 0, 0, 'SAMPLE-A-002', CURRENT_DATE + 120, receiving_location_id, '미수령 예시'
  FROM products p
  WHERE p.code = 'P-003' AND EXISTS (SELECT 1 FROM inbound_orders WHERE id = pending_order_id)
  UNION ALL
  SELECT receiving_order_id, p.id, 60, 52, 0, 0, 'SAMPLE-B-001', CURRENT_DATE + 240, storage_location_id, '일부 수령 예시'
  FROM products p
  WHERE p.code = 'P-002' AND EXISTS (SELECT 1 FROM inbound_orders WHERE id = receiving_order_id)
  UNION ALL
  SELECT receiving_order_id, p.id, 24, 24, 0, 0, 'SAMPLE-B-002', CURRENT_DATE + 365, storage_location_id, '수령 완료 예시'
  FROM products p
  WHERE p.code = 'P-004' AND EXISTS (SELECT 1 FROM inbound_orders WHERE id = receiving_order_id)
  UNION ALL
  SELECT inspecting_order_id, p.id, 40, 40, 38, 2, 'SAMPLE-C-001', CURRENT_DATE + 150, storage_location_id, '합격 38개, 불량 2개 예시'
  FROM products p
  WHERE p.code = 'P-005' AND EXISTS (SELECT 1 FROM inbound_orders WHERE id = inspecting_order_id);
END $$;
