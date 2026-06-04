-- products 테이블: 거래처/위치를 텍스트에서 FK로 전환
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS client_id   UUID REFERENCES clients(id)   ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

-- 기존 텍스트 컬럼 제거
ALTER TABLE products
    DROP COLUMN IF EXISTS brand,
    DROP COLUMN IF EXISTS location;

-- 조회 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_products_client   ON products(client_id)   WHERE client_id   IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_location ON products(location_id) WHERE location_id IS NOT NULL;
