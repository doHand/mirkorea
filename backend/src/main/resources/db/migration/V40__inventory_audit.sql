-- 재고조사 세션
CREATE TABLE inventory_audits (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id   UUID        NOT NULL REFERENCES warehouses(id),
    audit_date     DATE        NOT NULL,
    memo           TEXT,
    status         VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                   CHECK (status IN ('DRAFT', 'CONFIRMED')),
    confirmed_at   TIMESTAMPTZ,
    confirmed_by   UUID        REFERENCES users(id),
    created_by     UUID        NOT NULL REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 재고조사 항목 (창고 내 전체 재고 스냅샷 + 실사 수량)
CREATE TABLE inventory_audit_items (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id       UUID        NOT NULL REFERENCES inventory_audits(id) ON DELETE CASCADE,
    product_id     UUID        NOT NULL REFERENCES products(id),
    location_id    UUID        NOT NULL REFERENCES locations(id),
    lot_number     VARCHAR(100),
    system_qty     INT         NOT NULL DEFAULT 0,
    counted_qty    INT,
    txn_id         UUID        REFERENCES stock_transactions(id)
);

CREATE UNIQUE INDEX idx_audit_item_unique ON inventory_audit_items(audit_id, product_id, location_id, COALESCE(lot_number, ''));
CREATE INDEX idx_audit_warehouse ON inventory_audits(warehouse_id, audit_date DESC);
CREATE INDEX idx_audit_item_audit ON inventory_audit_items(audit_id);
