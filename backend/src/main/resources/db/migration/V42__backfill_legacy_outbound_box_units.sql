-- Legacy outbound_order_items used box_count as the user-entered BOX quantity.
-- Preserve that meaning while making inventory-facing values explicit EA quantities.
UPDATE outbound_order_items oi
SET input_qty = oi.box_count,
    input_unit = 'BOX',
    conversion_qty = COALESCE(NULLIF(p.box_unit_qty, 0), NULLIF(p.box_qty, 0), 1),
    converted_ea_qty = oi.box_count * COALESCE(NULLIF(p.box_unit_qty, 0), NULLIF(p.box_qty, 0), 1)
FROM products p
WHERE p.id = oi.product_id;
