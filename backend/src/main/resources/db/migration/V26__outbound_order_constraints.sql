ALTER TABLE outbound_orders
    ALTER COLUMN requested_ship_date SET NOT NULL,
    ADD CONSTRAINT chk_outbound_order_status
        CHECK (status IN ('COLLECTED', 'INSTRUCTED', 'CANCELLED'));

ALTER TABLE outbound_order_items
    ADD CONSTRAINT chk_outbound_order_item_box_count
        CHECK (box_count > 0);
