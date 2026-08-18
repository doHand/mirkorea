CREATE TABLE return_collections (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type                    VARCHAR(10) NOT NULL,              -- RETURN | RECALL
    product_id              UUID NOT NULL REFERENCES products(id),
    warehouse_id            UUID NOT NULL REFERENCES warehouses(id),
    location_id             UUID REFERENCES locations(id) ON DELETE SET NULL,
    quantity                INT NOT NULL CHECK (quantity > 0),
    lot_number              VARCHAR(100),
    outbound_order_id       UUID REFERENCES outbound_orders(id) ON DELETE SET NULL,
    outbound_order_item_id  UUID REFERENCES outbound_order_items(id) ON DELETE SET NULL,
    client_id               UUID REFERENCES clients(id) ON DELETE SET NULL,
    reason                  VARCHAR(50),
    memo                    TEXT,
    barcode_scanned         VARCHAR(100),
    created_by              UUID NOT NULL REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_return_collections_warehouse    ON return_collections(warehouse_id);
CREATE INDEX idx_return_collections_product      ON return_collections(product_id);
CREATE INDEX idx_return_collections_type         ON return_collections(type);
CREATE INDEX idx_return_collections_order_item   ON return_collections(outbound_order_item_id);
CREATE INDEX idx_return_collections_created      ON return_collections(created_at);
