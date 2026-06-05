-- products 테이블: 엔티티에 추가된 컬럼들 반영
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS material_no  VARCHAR(50),
    ADD COLUMN IF NOT EXISTS price_a      NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS price_b      NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS price_c      NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS retail_price NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS memo         VARCHAR(500);
