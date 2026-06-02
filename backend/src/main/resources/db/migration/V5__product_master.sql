-- 상품 마스터 확장: 옵션명, 규격 컬럼 추가
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS option_name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS spec        VARCHAR(200);

-- 단위 마스터 테이블
CREATE TABLE IF NOT EXISTS product_units (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(20)  NOT NULL UNIQUE,
    label       VARCHAR(50)  NOT NULL,
    description VARCHAR(200),
    sort_order  INT          NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO product_units (code, label, description, sort_order) VALUES
    ('EA',     '낱개',    '개별 단위 (Each)',  1),
    ('BOX',    '박스',    '박스 단위',          2),
    ('PALLET', '파레트',  '파레트 단위',        3)
ON CONFLICT (code) DO NOTHING;
