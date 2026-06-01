-- WMS Pro 초기 스키마
-- V1: 전체 테이블 생성

-- 트랜잭션 번호 채번 시퀀스 (동시성 안전)
CREATE SEQUENCE IF NOT EXISTS txn_seq START 1 INCREMENT 1;

-- 사용자
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

-- 창고
CREATE TABLE warehouses (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(20) NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    address     TEXT,
    manager_id  UUID        REFERENCES users(id),
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 구역 (Zone)
CREATE TABLE zones (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID        NOT NULL REFERENCES warehouses(id),
    code         VARCHAR(10) NOT NULL,
    name         VARCHAR(50) NOT NULL,
    type         VARCHAR(20) NOT NULL DEFAULT 'STORAGE'
                 CHECK (type IN ('STORAGE','RECEIVING','SHIPPING','STAGING','DAMAGED')),
    is_active    BOOLEAN     NOT NULL DEFAULT true,
    UNIQUE (warehouse_id, code)
);

-- 위치 (Location)
CREATE TABLE locations (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id  UUID        NOT NULL REFERENCES warehouses(id),
    zone_id       UUID        NOT NULL REFERENCES zones(id),
    code          VARCHAR(50) NOT NULL UNIQUE,
    aisle         VARCHAR(10),
    rack          VARCHAR(10),
    shelf         VARCHAR(10),
    bin           VARCHAR(10),
    capacity_unit INT         NOT NULL DEFAULT 9999,
    is_active     BOOLEAN     NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 상품
CREATE TABLE products (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code               VARCHAR(50)  NOT NULL UNIQUE,
    name               VARCHAR(200) NOT NULL,
    category           VARCHAR(100),
    brand              VARCHAR(100),
    unit               VARCHAR(20)  NOT NULL DEFAULT 'EA',
    box_qty            INT          NOT NULL DEFAULT 1,
    weight_g           INT,
    image_url          VARCHAR(500),
    safety_stock       INT          NOT NULL DEFAULT 0,
    reorder_point      INT          NOT NULL DEFAULT 0,
    cost_price         NUMERIC(15,2),
    sell_price         NUMERIC(15,2),
    sale_status        VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                       CHECK (sale_status IN ('ACTIVE','INACTIVE','DISCONTINUED')),
    is_lot_managed     BOOLEAN      NOT NULL DEFAULT false,
    is_expiry_managed  BOOLEAN      NOT NULL DEFAULT false,
    created_by         UUID         REFERENCES users(id),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 바코드
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

-- 재고 (직접 수정 금지 — stock_transactions 통해서만 변경)
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

-- 재고 원장 (절대 DELETE/UPDATE 금지, 취소는 새 행 INSERT)
CREATE TABLE stock_transactions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    txn_no          VARCHAR(30) NOT NULL UNIQUE,
    product_id      UUID        NOT NULL REFERENCES products(id),
    location_id     UUID        NOT NULL REFERENCES locations(id),
    warehouse_id    UUID        NOT NULL REFERENCES warehouses(id),
    qty             INT         NOT NULL,          -- 양수=증가, 음수=감소
    qty_before      INT         NOT NULL,
    qty_after       INT         NOT NULL,
    tx_type         VARCHAR(30) NOT NULL
                    CHECK (tx_type IN (
                        'INBOUND','INBOUND_CANCEL',
                        'OUTBOUND','OUTBOUND_CANCEL',
                        'ADJUST_INCREASE','ADJUST_DECREASE',
                        'MOVE_OUT','MOVE_IN',
                        'INITIAL'
                    )),
    reference_type  VARCHAR(30),
    reference_id    UUID,
    lot_number      VARCHAR(100),
    expiry_date     DATE,
    barcode_scanned VARCHAR(100),
    reason          TEXT,
    memo            TEXT,
    is_cancelled    BOOLEAN     NOT NULL DEFAULT false,
    cancelled_by    UUID        REFERENCES users(id),
    cancelled_at    TIMESTAMPTZ,
    created_by      UUID        NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 인덱스 ──────────────────────────────────────────────────────
CREATE INDEX idx_products_code    ON products(code);
CREATE INDEX idx_products_status  ON products(sale_status);

CREATE INDEX idx_barcodes_value   ON barcodes(barcode) WHERE is_active = true;
CREATE INDEX idx_barcodes_product ON barcodes(product_id);

CREATE INDEX idx_inventory_product   ON inventory(product_id);
CREATE INDEX idx_inventory_location  ON inventory(location_id);
CREATE INDEX idx_inventory_warehouse ON inventory(warehouse_id);
CREATE INDEX idx_inventory_low       ON inventory(warehouse_id, product_id)
    WHERE quantity = 0;

CREATE INDEX idx_txn_product   ON stock_transactions(product_id, created_at DESC);
CREATE INDEX idx_txn_location  ON stock_transactions(location_id, created_at DESC);
CREATE INDEX idx_txn_warehouse ON stock_transactions(warehouse_id, tx_type);
CREATE INDEX idx_txn_ref       ON stock_transactions(reference_type, reference_id);
CREATE INDEX idx_txn_date      ON stock_transactions(created_at DESC);
CREATE INDEX idx_txn_type      ON stock_transactions(tx_type, created_at DESC);

CREATE INDEX idx_locations_zone      ON locations(zone_id);
CREATE INDEX idx_locations_warehouse ON locations(warehouse_id);
