CREATE TABLE outbound_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_no VARCHAR(30) NOT NULL UNIQUE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    channel VARCHAR(100),
    external_order_no VARCHAR(100),
    customer VARCHAR(200) NOT NULL,
    recipient VARCHAR(100),
    phone VARCHAR(50),
    address VARCHAR(500),
    order_date DATE NOT NULL,
    requested_ship_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'COLLECTED',
    instructed_at TIMESTAMPTZ,
    memo TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE outbound_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbound_order_id UUID NOT NULL REFERENCES outbound_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    box_count INT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_outbound_orders_warehouse ON outbound_orders(warehouse_id);
CREATE INDEX idx_outbound_orders_status ON outbound_orders(status);
CREATE INDEX idx_outbound_order_items_order ON outbound_order_items(outbound_order_id);
CREATE SEQUENCE outbound_order_seq START 1;
