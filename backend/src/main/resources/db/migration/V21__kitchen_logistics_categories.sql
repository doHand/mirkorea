CREATE TABLE IF NOT EXISTS product_categories (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(300),
    sort_order  INT          NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO product_categories (name, description, sort_order) VALUES
    ('식기/테이블웨어', '접시, 그릇, 컵, 수저 등 테이블 세팅 상품', 10),
    ('조리도구', '칼, 도마, 집게, 국자, 뒤집개 등 조리 보조 도구', 20),
    ('냄비/팬', '냄비, 프라이팬, 웍, 찜기 등 가열 조리 용품', 30),
    ('주방가전', '믹서기, 전기포트, 밥솥 등 주방용 전기 제품', 40),
    ('식자재 보관용품', '밀폐용기, 바트, 저장통 등 식자재 보관 용품', 50),
    ('포장/배달용품', '포장용기, 배달봉투, 일회용 수저 등 출고 포장 용품', 60),
    ('주방소모품', '랩, 호일, 키친타월, 장갑 등 반복 구매 소모품', 70),
    ('위생/청소용품', '세제, 수세미, 행주, 소독제 등 위생 관리 용품', 80),
    ('음료/바 용품', '텀블러, 피처, 쉐이커 등 음료 제조 및 서빙 용품', 90),
    ('업소용 주방설비', '작업대, 선반, 운반카트 등 업소용 주방 설비', 100)
ON CONFLICT (name) DO NOTHING;
