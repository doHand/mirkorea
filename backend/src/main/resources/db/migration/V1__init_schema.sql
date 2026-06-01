-- PostgreSQL UUID 생성을 위한 확장입니다.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 재고 트랜잭션 번호 채번에 사용할 시퀀스입니다.
CREATE SEQUENCE IF NOT EXISTS txn_seq START 1 INCREMENT 1;

-- 사용자 계정과 권한 정보를 저장합니다.
CREATE TABLE users (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(50) NOT NULL UNIQUE,
    email           VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(100) NOT NULL,
    role            VARCHAR(20)  NOT NULL DEFAULT 'WORKER'
                    CHECK (role IN ('ADMIN','MANAGER','WORKER','VIEWER')),
    warehouse_id    UUID,
    is_active       BOOLEAN     NOT NULL DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 창고 기본 정보를 저장합니다.
CREATE TABLE warehouses (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(20)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    address     TEXT,
    manager_id  UUID         REFERENCES users(id),
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 창고 안의 보관/입고/출고 구역을 관리합니다.
CREATE TABLE zones (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id  UUID        NOT NULL REFERENCES warehouses(id),
    code          VARCHAR(10) NOT NULL,
    name          VARCHAR(50) NOT NULL,
    type          VARCHAR(20) NOT NULL DEFAULT 'STORAGE'
                  CHECK (type IN ('STORAGE','RECEIVING','SHIPPING','STAGING','DAMAGED')),
    is_active     BOOLEAN     NOT NULL DEFAULT true,
    UNIQUE (warehouse_id, code)
);

-- 실제 재고가 적치되는 로케이션 정보를 저장합니다.
CREATE TABLE locations (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id   UUID        NOT NULL REFERENCES warehouses(id),
    zone_id        UUID        NOT NULL REFERENCES zones(id),
    code           VARCHAR(50) NOT NULL UNIQUE,
    aisle          VARCHAR(10),
    rack           VARCHAR(10),
    shelf          VARCHAR(10),
    bin            VARCHAR(10),
    capacity_unit  INT         NOT NULL DEFAULT 9999,
    is_active      BOOLEAN     NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 상품 마스터와 재고 정책 정보를 저장합니다.
CREATE TABLE products (
    id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    code               VARCHAR(50)   NOT NULL UNIQUE,
    name               VARCHAR(200)  NOT NULL,
    category           VARCHAR(100),
    brand              VARCHAR(100),
    unit               VARCHAR(20)   NOT NULL DEFAULT 'EA',
    box_qty            INT           NOT NULL DEFAULT 1,
    weight_g           INT,
    image_url          VARCHAR(500),
    safety_stock       INT           NOT NULL DEFAULT 0,
    reorder_point      INT           NOT NULL DEFAULT 0,
    cost_price         NUMERIC(15,2),
    sell_price         NUMERIC(15,2),
    sale_status        VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'
                       CHECK (sale_status IN ('ACTIVE','INACTIVE','DISCONTINUED')),
    is_lot_managed     BOOLEAN       NOT NULL DEFAULT false,
    is_expiry_managed  BOOLEAN       NOT NULL DEFAULT false,
    created_by         UUID          REFERENCES users(id),
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- 상품별 바코드와 포장 단위를 관리합니다.
CREATE TABLE barcodes (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID         NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    barcode     VARCHAR(100) NOT NULL UNIQUE,
    type        VARCHAR(10)  NOT NULL DEFAULT 'UNIT'
                CHECK (type IN ('UNIT','BOX','INNER','PALLET')),
    unit_qty    INT          NOT NULL DEFAULT 1,
    is_primary  BOOLEAN      NOT NULL DEFAULT false,
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 현재 위치별 재고 수량을 빠르게 조회하기 위한 재고 테이블입니다.
CREATE TABLE inventory (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID        NOT NULL REFERENCES products(id),
    location_id     UUID        NOT NULL REFERENCES locations(id),
    warehouse_id    UUID        NOT NULL REFERENCES warehouses(id),
    quantity        INT         NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reserved_qty    INT         NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
    lot_number      VARCHAR(100),
    expire_date     DATE,
    version         INT         NOT NULL DEFAULT 1,
    last_synced_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, location_id, lot_number)
);

-- 입고, 출고, 조정, 이동 이력을 append-only 방식으로 기록합니다.
CREATE TABLE stock_transactions (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    txn_no           VARCHAR(30) NOT NULL UNIQUE,
    product_id       UUID        NOT NULL REFERENCES products(id),
    location_id      UUID        NOT NULL REFERENCES locations(id),
    warehouse_id     UUID        NOT NULL REFERENCES warehouses(id),
    qty              INT         NOT NULL,
    qty_before       INT         NOT NULL,
    qty_after        INT         NOT NULL,
    tx_type          VARCHAR(30) NOT NULL
                     CHECK (tx_type IN (
                         'INBOUND','INBOUND_CANCEL',
                         'OUTBOUND','OUTBOUND_CANCEL',
                         'ADJUST_INCREASE','ADJUST_DECREASE',
                         'MOVE_OUT','MOVE_IN',
                         'INITIAL'
                     )),
    reference_type   VARCHAR(30),
    reference_id     UUID,
    lot_number       VARCHAR(100),
    expiry_date      DATE,
    barcode_scanned  VARCHAR(100),
    reason           TEXT,
    memo             TEXT,
    is_cancelled     BOOLEAN     NOT NULL DEFAULT false,
    cancelled_by     UUID        REFERENCES users(id),
    cancelled_at     TIMESTAMPTZ,
    created_by       UUID        NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 상품 검색과 상태 필터링을 위한 인덱스입니다.
CREATE INDEX idx_products_code    ON products(code);
CREATE INDEX idx_products_status  ON products(sale_status);

-- 바코드 스캔과 상품별 바코드 조회를 위한 인덱스입니다.
CREATE INDEX idx_barcodes_value   ON barcodes(barcode) WHERE is_active = true;
CREATE INDEX idx_barcodes_product ON barcodes(product_id);

-- 재고 화면의 상품/위치/창고별 조회를 위한 인덱스입니다.
CREATE INDEX idx_inventory_product   ON inventory(product_id);
CREATE INDEX idx_inventory_location  ON inventory(location_id);
CREATE INDEX idx_inventory_warehouse ON inventory(warehouse_id);
CREATE INDEX idx_inventory_low       ON inventory(warehouse_id, product_id)
    WHERE quantity = 0;

-- 재고 이력 조회와 참조 문서 역추적을 위한 인덱스입니다.
CREATE INDEX idx_txn_product   ON stock_transactions(product_id, created_at DESC);
CREATE INDEX idx_txn_location  ON stock_transactions(location_id, created_at DESC);
CREATE INDEX idx_txn_warehouse ON stock_transactions(warehouse_id, tx_type);
CREATE INDEX idx_txn_ref       ON stock_transactions(reference_type, reference_id);
CREATE INDEX idx_txn_date      ON stock_transactions(created_at DESC);
CREATE INDEX idx_txn_type      ON stock_transactions(tx_type, created_at DESC);

-- 창고 배치도와 구역별 로케이션 조회를 위한 인덱스입니다.
CREATE INDEX idx_locations_zone      ON locations(zone_id);
CREATE INDEX idx_locations_warehouse ON locations(warehouse_id);
