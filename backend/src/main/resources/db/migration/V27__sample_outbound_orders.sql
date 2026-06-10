DO $$
DECLARE
  admin_id UUID;
  wh_id UUID;
  order_1 UUID := '30000000-0000-0000-0000-000000000001';
  order_2 UUID := '30000000-0000-0000-0000-000000000002';
  order_3 UUID := '30000000-0000-0000-0000-000000000003';
  order_4 UUID := '30000000-0000-0000-0000-000000000004';
  order_5 UUID := '30000000-0000-0000-0000-000000000005';
  order_6 UUID := '30000000-0000-0000-0000-000000000006';
BEGIN
  SELECT id INTO admin_id FROM users WHERE username = 'admin' LIMIT 1;
  SELECT id INTO wh_id FROM warehouses WHERE code = 'WH-001' LIMIT 1;

  IF admin_id IS NULL OR wh_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO outbound_orders
    (id, order_no, warehouse_id, channel, external_order_no, customer, recipient, phone, address,
     order_date, requested_ship_date, status, instructed_at, memo, created_by, created_at, updated_at)
  VALUES
    (order_1, 'SO-SAMPLE-001', wh_id, '전화주문', 'CALL-20260610-01', '해피미르 본점', '김민수',
     '010-1234-1001', '서울시 강남구 테헤란로 101', CURRENT_DATE, CURRENT_DATE, 'INSTRUCTED',
     now() - interval '70 minutes', '오전 중 도착 요청', admin_id, now() - interval '2 hours', now() - interval '70 minutes'),
    (order_2, 'SO-SAMPLE-002', wh_id, '네이버', 'NAVER-260610-002', '네이버 스마트스토어', '이서연',
     '010-1234-1002', '경기도 성남시 분당구 판교로 22', CURRENT_DATE, CURRENT_DATE, 'INSTRUCTED',
     now() - interval '55 minutes', NULL, admin_id, now() - interval '100 minutes', now() - interval '55 minutes'),
    (order_3, 'SO-SAMPLE-003', wh_id, '카카오톡', 'KAKAO-260610-003', '미르마트 파주점', '박정우',
     '010-1234-1003', '경기도 파주시 탄현면 헤이리로 133', CURRENT_DATE, CURRENT_DATE, 'INSTRUCTED',
     now() - interval '40 minutes', '매장 후문 하차', admin_id, now() - interval '80 minutes', now() - interval '40 minutes'),
    (order_4, 'SO-SAMPLE-004', wh_id, '영업팀', 'SALES-260610-004', '한빛유통', '최지훈',
     '010-1234-1004', '인천시 남동구 산업로 88', CURRENT_DATE, CURRENT_DATE, 'INSTRUCTED',
     now() - interval '25 minutes', NULL, admin_id, now() - interval '60 minutes', now() - interval '25 minutes'),
    (order_5, 'SO-SAMPLE-005', wh_id, '엑셀수집', 'EXCEL-260611-005', '우리상회', '정다은',
     '010-1234-1005', '서울시 송파구 올림픽로 300', CURRENT_DATE, CURRENT_DATE + 1, 'INSTRUCTED',
     now() - interval '10 minutes', '내일 오전 출고', admin_id, now() - interval '40 minutes', now() - interval '10 minutes'),
    (order_6, 'SO-SAMPLE-006', wh_id, '전화주문', 'CALL-20260610-006', '새봄식자재', '윤서준',
     '010-1234-1006', '경기도 고양시 일산동구 중앙로 50', CURRENT_DATE, CURRENT_DATE, 'COLLECTED',
     NULL, '출고지시 전 샘플 주문', admin_id, now() - interval '20 minutes', now() - interval '20 minutes')
  ON CONFLICT (order_no) DO NOTHING;

  INSERT INTO outbound_order_items (outbound_order_id, product_id, box_count, sort_order)
  SELECT order_1, id, 12, 0 FROM products WHERE code = 'P-001' AND EXISTS (SELECT 1 FROM outbound_orders WHERE id = order_1)
  UNION ALL SELECT order_1, id, 8, 1 FROM products WHERE code = 'P-002' AND EXISTS (SELECT 1 FROM outbound_orders WHERE id = order_1)
  UNION ALL SELECT order_1, id, 6, 2 FROM products WHERE code = 'P-004' AND EXISTS (SELECT 1 FROM outbound_orders WHERE id = order_1)

  UNION ALL SELECT order_2, id, 7, 0 FROM products WHERE code = 'P-001' AND EXISTS (SELECT 1 FROM outbound_orders WHERE id = order_2)
  UNION ALL SELECT order_2, id, 10, 1 FROM products WHERE code = 'P-003' AND EXISTS (SELECT 1 FROM outbound_orders WHERE id = order_2)
  UNION ALL SELECT order_2, id, 4, 2 FROM products WHERE code = 'P-005' AND EXISTS (SELECT 1 FROM outbound_orders WHERE id = order_2)

  UNION ALL SELECT order_3, id, 15, 0 FROM products WHERE code = 'P-004' AND EXISTS (SELECT 1 FROM outbound_orders WHERE id = order_3)
  UNION ALL SELECT order_3, id, 9, 1 FROM products WHERE code = 'P-002' AND EXISTS (SELECT 1 FROM outbound_orders WHERE id = order_3)
  UNION ALL SELECT order_3, id, 5, 2 FROM products WHERE code = 'P-003' AND EXISTS (SELECT 1 FROM outbound_orders WHERE id = order_3)

  UNION ALL SELECT order_4, id, 20, 0 FROM products WHERE code = 'P-001' AND EXISTS (SELECT 1 FROM outbound_orders WHERE id = order_4)
  UNION ALL SELECT order_4, id, 18, 1 FROM products WHERE code = 'P-004' AND EXISTS (SELECT 1 FROM outbound_orders WHERE id = order_4)
  UNION ALL SELECT order_4, id, 6, 2 FROM products WHERE code = 'P-002' AND EXISTS (SELECT 1 FROM outbound_orders WHERE id = order_4)

  UNION ALL SELECT order_5, id, 10, 0 FROM products WHERE code = 'P-001' AND EXISTS (SELECT 1 FROM outbound_orders WHERE id = order_5)
  UNION ALL SELECT order_5, id, 12, 1 FROM products WHERE code = 'P-004' AND EXISTS (SELECT 1 FROM outbound_orders WHERE id = order_5)

  UNION ALL SELECT order_6, id, 8, 0 FROM products WHERE code = 'P-003' AND EXISTS (SELECT 1 FROM outbound_orders WHERE id = order_6)
  UNION ALL SELECT order_6, id, 3, 1 FROM products WHERE code = 'P-005' AND EXISTS (SELECT 1 FROM outbound_orders WHERE id = order_6);
END $$;
