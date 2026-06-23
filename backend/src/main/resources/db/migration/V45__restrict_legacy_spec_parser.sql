-- Only a simple leading form such as "12EA/BOX" is an EA-per-BOX declaration.
-- Composite text (for example "INBOX 5EA / BOX 10 INBOX") keeps the legacy box_qty value.
UPDATE products
SET box_unit_qty = box_qty
WHERE spec !~* '^[[:space:]]*[0-9]+[[:space:]]*EA[[:space:]]*/[[:space:]]*BOX[[:space:]]*$';

UPDATE outbound_order_items oi
SET conversion_qty = p.box_unit_qty,
    converted_ea_qty = oi.input_qty * p.box_unit_qty
FROM products p
WHERE oi.product_id = p.id AND oi.input_unit = 'BOX';
