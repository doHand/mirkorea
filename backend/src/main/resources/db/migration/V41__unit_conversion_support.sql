-- Inventory quantities remain EA. Legacy rows are preserved with EA/one-to-one defaults.
ALTER TABLE products ADD COLUMN IF NOT EXISTS base_unit VARCHAR(10) NOT NULL DEFAULT 'EA';
ALTER TABLE products ADD COLUMN IF NOT EXISTS p_unit_qty INT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS box_unit_qty INT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pl_unit_qty INT;
UPDATE products SET box_unit_qty = box_qty WHERE box_unit_qty IS NULL AND box_qty > 0;

ALTER TABLE inbound_order_items ADD COLUMN IF NOT EXISTS input_qty INT NOT NULL DEFAULT 0;
ALTER TABLE inbound_order_items ADD COLUMN IF NOT EXISTS input_unit VARCHAR(10) NOT NULL DEFAULT 'EA';
ALTER TABLE inbound_order_items ADD COLUMN IF NOT EXISTS conversion_qty INT NOT NULL DEFAULT 1;
ALTER TABLE inbound_order_items ADD COLUMN IF NOT EXISTS converted_ea_qty INT NOT NULL DEFAULT 0;
UPDATE inbound_order_items SET input_qty = expected_qty, converted_ea_qty = expected_qty WHERE input_qty = 0;

ALTER TABLE outbound_order_items ADD COLUMN IF NOT EXISTS input_qty INT NOT NULL DEFAULT 0;
ALTER TABLE outbound_order_items ADD COLUMN IF NOT EXISTS input_unit VARCHAR(10) NOT NULL DEFAULT 'EA';
ALTER TABLE outbound_order_items ADD COLUMN IF NOT EXISTS conversion_qty INT NOT NULL DEFAULT 1;
ALTER TABLE outbound_order_items ADD COLUMN IF NOT EXISTS converted_ea_qty INT NOT NULL DEFAULT 0;
UPDATE outbound_order_items SET input_qty = box_count, converted_ea_qty = box_count WHERE input_qty = 0;

ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS input_unit VARCHAR(10) NOT NULL DEFAULT 'EA';
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS conversion_qty INT NOT NULL DEFAULT 1;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS converted_ea_qty INT NOT NULL DEFAULT 0;
UPDATE purchase_order_items SET converted_ea_qty = quantity WHERE converted_ea_qty = 0;
