-- Provide a small first-run timeline for the audit-log screen without touching business data.
INSERT INTO audit_logs (id, action, target_type, target_id, summary, actor, request_path, created_at)
SELECT gen_random_uuid(), sample.action, sample.target_type, NULL, sample.summary, sample.actor, sample.request_path, sample.created_at
FROM (
    VALUES
      ('POST',  'products', '상품 등록 · 샘플 주방세제',     'admin',    '/api/v1/products',       CURRENT_TIMESTAMP - INTERVAL '15 minutes'),
      ('PATCH', 'products', '상품 수정 · 안전재고 변경',     'manager1', '/api/v1/products/sample', CURRENT_TIMESTAMP - INTERVAL '1 hour'),
      ('POST',  'inbound',  '입고 예정 등록 · 샘플 발주',    'manager1', '/api/v1/inbound',        CURRENT_TIMESTAMP - INTERVAL '3 hours'),
      ('PUT',   'clients',  '거래처 정보 수정 · 연락처 변경','admin',    '/api/v1/clients/sample', CURRENT_TIMESTAMP - INTERVAL '1 day')
) AS sample(action, target_type, summary, actor, request_path, created_at)
WHERE NOT EXISTS (SELECT 1 FROM audit_logs);
