CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_no VARCHAR(30) NOT NULL UNIQUE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    supplier VARCHAR(200),
    order_date DATE NOT NULL,
    expected_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    memo TEXT,
    inbound_order_id UUID REFERENCES inbound_orders(id),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_purchase_orders_warehouse ON purchase_orders(warehouse_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_order_items_order ON purchase_order_items(purchase_order_id);
CREATE SEQUENCE purchase_order_seq START 1;
