CREATE TABLE outbound_picking_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    picking_date DATE NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id),
    location_id UUID NOT NULL REFERENCES locations(id),
    picked_box_count INT NOT NULL DEFAULT 0 CHECK (picked_box_count >= 0),
    CONSTRAINT uq_outbound_picking_progress UNIQUE (warehouse_id, picking_date, product_id, location_id)
);

CREATE INDEX idx_outbound_picking_progress_date
    ON outbound_picking_progress(warehouse_id, picking_date);
