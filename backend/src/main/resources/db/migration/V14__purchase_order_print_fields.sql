ALTER TABLE purchase_orders
    ADD COLUMN manager VARCHAR(100),
    ADD COLUMN phone VARCHAR(50),
    ADD COLUMN fax VARCHAR(50);

ALTER TABLE purchase_order_items
    ADD COLUMN box_count INT NOT NULL DEFAULT 0,
    ADD COLUMN cap_size VARCHAR(100);
