-- 입고 관리: 입고 예정 주문 테이블
CREATE TABLE inbound_orders (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    order_no      VARCHAR(30)  NOT NULL UNIQUE,
    warehouse_id  UUID         NOT NULL REFERENCES warehouses(id),
    supplier      VARCHAR(200),
    expected_date DATE,
    status        VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    memo          TEXT,
    created_by    UUID         NOT NULL REFERENCES users(id),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 입고 예정 품목 테이블
CREATE TABLE inbound_order_items (
    id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id           UUID    NOT NULL REFERENCES inbound_orders(id) ON DELETE CASCADE,
    product_id         UUID    NOT NULL REFERENCES products(id),
    expected_qty       INT     NOT NULL DEFAULT 0,
    received_qty       INT     NOT NULL DEFAULT 0,
    passed_qty         INT     NOT NULL DEFAULT 0,
    defect_qty         INT     NOT NULL DEFAULT 0,
    lot_number         VARCHAR(100),
    expire_date        DATE,
    location_id        UUID    REFERENCES locations(id),
    defect_location_id UUID    REFERENCES locations(id),
    barcode_scanned    VARCHAR(100),
    note               TEXT
);

CREATE INDEX idx_inbound_orders_warehouse ON inbound_orders(warehouse_id);
CREATE INDEX idx_inbound_orders_status    ON inbound_orders(status);
CREATE INDEX idx_inbound_items_order      ON inbound_order_items(order_id);

-- 입고 주문 번호 시퀀스
CREATE SEQUENCE inbound_seq START 1;
