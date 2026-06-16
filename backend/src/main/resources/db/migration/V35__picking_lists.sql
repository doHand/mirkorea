CREATE TABLE picking_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    picking_date DATE NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE picking_list_orders (
    picking_list_id UUID NOT NULL REFERENCES picking_lists(id) ON DELETE CASCADE,
    outbound_order_id UUID NOT NULL REFERENCES outbound_orders(id) ON DELETE CASCADE,
    PRIMARY KEY (picking_list_id, outbound_order_id)
);

CREATE INDEX idx_picking_lists_warehouse_date ON picking_lists(warehouse_id, picking_date DESC);
CREATE INDEX idx_picking_list_orders_order ON picking_list_orders(outbound_order_id);
