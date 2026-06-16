ALTER TABLE outbound_order_items
    ADD COLUMN picked_box_count INT NOT NULL DEFAULT 0,
    ADD CONSTRAINT chk_outbound_order_item_picked_box_count
        CHECK (picked_box_count >= 0 AND picked_box_count <= box_count);
